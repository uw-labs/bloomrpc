import { EventEmitter } from "events";
import { credentials, Metadata, ServiceError } from "grpc";
import { ProtoInfo } from './protoInfo';
import * as grpc from 'grpc';
import * as fs from "fs";
import { Certificate } from "./importCertificates";
import * as grpcWeb from 'grpc-web'
import { Utf8AsciiBinaryEncoding } from "crypto";

export interface GRPCEventEmitter extends EventEmitter {
  protoInfo: ProtoInfo;
  send(): GRPCEventEmitter;
  write(data: string): GRPCEventEmitter;
  commitStream(): void;
  cancel(): void;
}

export interface GRPCRequestInfo {
  url: string;
  protoInfo: ProtoInfo;
  metadata: string;
  inputs: string;
  interactive?: boolean;
  tlsCertificate?: Certificate;
}

export interface ResponseMetaInformation {
  responseTime?: number;
  stream?: boolean;
}

export const GRPCEventType = {
  DATA: "DATA",
  ERROR: "ERROR",
  END: "END",
};

export class GRPCRequest extends EventEmitter {
  url: string;
  protoInfo: ProtoInfo;
  metadata: string;
  inputs: string;
  interactive?: boolean;
  tlsCertificate?: Certificate;
  _call?: any;

  constructor({ url, protoInfo, metadata, inputs, interactive, tlsCertificate }: GRPCRequestInfo) {
    super();
    this.url = url;
    this.protoInfo = protoInfo;
    this.metadata = metadata;
    this.inputs = inputs;
    this.interactive = interactive;
    this.tlsCertificate = tlsCertificate;
    this._call = undefined;
  }

  send(): GRPCRequest {
    const serviceClient: any = this.protoInfo.client();
    const client: grpc.Client = this.getClient(serviceClient);
    let inputs = {};
    let metadata: {[key: string]: any} = {};

    try {
      const reqInfo = this.parseRequestInfo(this.inputs, this.metadata);
      inputs = reqInfo.inputs;
      metadata = reqInfo.metadata;
    } catch(e) {
      return this;
    }

    // Add metadata
    const md = new Metadata();
    Object.keys(metadata).forEach((key: string) => {
      if (key.endsWith("-bin")) {
        let encoding: Utf8AsciiBinaryEncoding = "utf8";
        let value = metadata[key];

        // can prefix the value with any encoding that the buffer supports
        // example:
        // binary://binaryvalue
        // utf8://anyvalue
        // base64://sombase64value
        const regexEncoding = /(^.*):\/\/(.*)/g;
        if (regexEncoding.test(value)) {
          const groups = new RegExp(regexEncoding).exec(value);

          if (groups) {
            encoding = groups[1] as Utf8AsciiBinaryEncoding;
            value = groups[2];
          }
        }

        md.add(key, Buffer.from(value, encoding));
      } else {
        md.add(key, metadata[key]);
      }
    });

    // Gather method information
    const methodDefinition = this.protoInfo.methodDef();

    // TODO: find proper type for call
    let call: any;
    const requestStartTime = new Date();

    if (methodDefinition.requestStream) {
      // Client side streaming
      call = this.clientSideStreaming(client, inputs, md, requestStartTime);
    } else {
      // Unary call
      call = this.unaryCall(client, inputs, md, requestStartTime);
    }

    // Server Streaming.
    if (methodDefinition.responseStream) {
      this.handleServerStreaming(call, requestStartTime);
    }

    this._call = call;

    this.on(GRPCEventType.END, () => {
      client.close();
    });

    return this;
  }

  /**
   * Write to a stream
   * @param data
   */
  write(data: string) {
    if (this._call) {
      // Add metadata
      let inputs = {};

      try {
        const reqInfo = this.parseRequestInfo(data);
        inputs = reqInfo.inputs;
      } catch(e) {
        return this;
      }
      this._call.write(inputs);
    }
    return this;
  }

  /**
   * Cancel request
   */
  cancel() {
    if (this._call) {
      this._call.cancel();
      this.emit(GRPCEventType.END);
    }
  }

  /**
   * Commit stream
   */
  commitStream() {
    if (this._call) {
      this._call.end();
    }
  }

  /**
   * Get grpc client for this relevant request
   * @param serviceClient
   */
  private getClient(serviceClient: any): grpc.Client {
    let creds = credentials.createInsecure();
    let options = {};

    if (this.tlsCertificate) {
      if (this.tlsCertificate.sslTargetHost) {
        options = {
          ...options,
          'grpc.ssl_target_name_override' : this.tlsCertificate.sslTargetHost,
          'grpc.default_authority': this.tlsCertificate.sslTargetHost,
        }
      }
      if(this.tlsCertificate.useServerCertificate === true) {
        creds = credentials.createSsl();
      } else {
        creds = credentials.createSsl(
            fs.readFileSync(this.tlsCertificate.rootCert.filePath),
            this.tlsCertificate.privateKey && fs.readFileSync(this.tlsCertificate.privateKey.filePath),
            this.tlsCertificate.certChain && fs.readFileSync(this.tlsCertificate.certChain.filePath),
        );
      }
    }

    return new serviceClient(this.url, creds, options);
  }

  /**
   * Issue a client side streaming request
   * @param client
   * @param inputs
   * @param md
   * @param requestStartTime
   */
  private clientSideStreaming(client: any, inputs: any, md: Metadata, requestStartTime?: Date) {
    const call = client[this.protoInfo.methodName](md, (err: ServiceError, response: any) => {
      this.handleUnaryResponse(err, response, requestStartTime);
    });

    if (inputs && Array.isArray(inputs.stream)) {
      inputs.stream.forEach((data: object) => {
        call.write(data);
      });
    } else {
      call.write(inputs);
    }

    if (!this.interactive) {
      call.end();
    }

    return call;
  }

  /**
   * Handle server side streaming response
   * @param call
   * @param streamStartTime
   */
  private handleServerStreaming(call: any, streamStartTime?: Date) {

    call.on('data', (data: object) => {
      const responseMetaInformation = this.responseMetaInformation(streamStartTime, true);
      this.emit(GRPCEventType.DATA, data, responseMetaInformation);
      streamStartTime = new Date();
    });

    call.on('error', (err: { [key: string]: any }) => {
      const responseMetaInformation = this.responseMetaInformation(streamStartTime, true);
      if (err && err.code !== 1) {
        this.emit(GRPCEventType.ERROR, err, responseMetaInformation);

        if (err.code === 2 || err.code === 14) { // Stream Removed.
          this.emit(GRPCEventType.END, call);
        }
      }
      streamStartTime = new Date();
    });

    call.on('end', () => {
      this.emit(GRPCEventType.END, this);
    });
  }

  /**
   * Send a unary call
   * @param client
   * @param inputs
   * @param md
   * @param requestStartTime
   */
  private unaryCall(client: any, inputs: any, md: Metadata, requestStartTime?: Date) {
    return client[this.protoInfo.methodName](inputs, md, (err: ServiceError, response: any) => {
      this.handleUnaryResponse(err, response, requestStartTime);
    });
  }

  /**
   * Handle unary response
   * @param err
   * @param response
   * @param requestStartTime
   */
  private handleUnaryResponse(err: ServiceError, response: any, requestStartTime?: Date) {
    const responseMetaInformation = this.responseMetaInformation(requestStartTime);

    // Client side streaming handler
    if (err) {
      // Request cancelled do nothing
      if (err.code === 1) {
        return;
      } else {
        this.emit(GRPCEventType.ERROR, err, responseMetaInformation);
      }
    } else {
      this.emit(GRPCEventType.DATA, response, responseMetaInformation);
    }
    this.emit(GRPCEventType.END);
  }

  /**
   * Response meta information
   * @param startTime
   * @param stream
   */
  private responseMetaInformation(startTime?: Date, stream?: boolean) {
    const responseDate = new Date();

    return {
      responseTime: startTime && (responseDate.getTime() - startTime.getTime()) / 1000,
      stream,
    };
  }

  /**
   * Parse JSON to request inputs / metadata
   * @param data
   * @param userMetadata
   */
  private parseRequestInfo(data: string, userMetadata?: string): { inputs: object, metadata: object } {
    let inputs = {};
    let metadata: {[key: string]: any} = {};

    try {
      inputs = JSON.parse(data || "{}")
    } catch (e) {
      e.message = "Couldn't parse JSON inputs Invalid json";
      this.emit(GRPCEventType.ERROR, e, {});
      this.emit(GRPCEventType.END);
      throw new Error(e);
    }

    if (userMetadata) {
      try {
        metadata = JSON.parse(userMetadata || "{}")
      } catch (e) {
        e.message = "Couldn't parse JSON metadata Invalid json";
        this.emit(GRPCEventType.ERROR, e, {});
        this.emit(GRPCEventType.END);
        throw new Error(e);
      }
    }

    return { inputs, metadata };
  }
}

export class GRPCWebRequest extends EventEmitter {
  url: string;
  protoInfo: ProtoInfo;
  metadata: string;
  inputs: string;
  interactive?: boolean;
  tlsCertificate?: Certificate;
  _call?: grpcWeb.ClientReadableStream<any>;
  _fullUrl?: string;

  constructor({ url, protoInfo, metadata, inputs, interactive, tlsCertificate }: GRPCRequestInfo) {
    super()
    this.url = url;
    this.protoInfo = protoInfo;
    this.metadata = metadata;
    this.inputs = inputs;
    this.interactive = interactive;
    this.tlsCertificate = tlsCertificate;
    this._call = undefined;
    this._fullUrl = undefined;
  }

  send(): GRPCWebRequest {
    const serviceClient: any = this.protoInfo.client();
    const client = new grpcWeb.GrpcWebClientBase({format: 'text'})
    let inputs = {};
    let metadata: {[key: string]: any} = {};

    try {
      const reqInfo = this.parseRequestInfo(this.inputs, this.metadata);
      inputs = reqInfo.inputs;
      metadata = reqInfo.metadata;
    } catch(e) {
      return this;
    }

    // TODO: find proper type for call
    let call: grpcWeb.ClientReadableStream<any>;
    const requestStartTime = new Date();

    const web = grpcWeb as any
    const rpc = serviceClient.service[this.protoInfo.methodName]

    let scheme = 'http://'
    if (this.url.startsWith("http://") || this.url.startsWith("https://")) {
      scheme = ''
    } else if (this.tlsCertificate) {
      if (this.tlsCertificate.useServerCertificate) {
        scheme = 'https://'
      } else {
        // TODO: can we do anything about self-signed CA?
      }
    }

    const fullUrl : string = scheme+this.url+rpc.path
    this._fullUrl = fullUrl

    const methodDescriptor = new web.MethodDescriptor(
      rpc.path, // name
      this.protoInfo.isServerStreaming() ? web.MethodType.SERVER_STREAMING : web.MethodType.UNARY, //method type
      function(){}, // request type
      function(){}, // response type
      rpc.requestSerialize, // request serialisation fn
      rpc.responseDeserialize // response serialisation fn
    );

    if (this.protoInfo.isClientStreaming()) {
      const err = new Error('client streaming is not supported in GRPC-Web at the moment')
      this.emit(GRPCEventType.ERROR, err, {});
      this.emit(GRPCEventType.END);
      throw err;
    }

    if (this.protoInfo.isServerStreaming()) {
      call = client.serverStreaming(
        fullUrl,
        inputs,
        metadata, //metadata
        methodDescriptor, // MethodDescriptor
      )
    } else {
      call = client.rpcCall(
        fullUrl,
        inputs,
        metadata,
        methodDescriptor,
        (err: grpcWeb.Error, response: any) => 
          this.handleUnaryResponse(err, response, requestStartTime)
      )
    }
    this._call = call

    if (this.protoInfo.isServerStreaming()) {
      this.handleServerStreaming(call, requestStartTime)
    }

    return this;
  }


  /**
   * Cancel request
   */
  cancel() {
    if (this._call) {
      this._call.cancel();
      this.emit(GRPCEventType.END);
    }
  }

  write() {
    return this;
  }

  commitStream(){ }

  /**
   * Handle server side streaming response
   * @param call
   * @param streamStartTime
   */
  private handleServerStreaming(call: grpcWeb.ClientReadableStream<any>, streamStartTime?: Date) {
    call.on('data', (data: object) => {
      const responseMetaInformation = this.responseMetaInformation(streamStartTime, true);
      this.emit(GRPCEventType.DATA, data, responseMetaInformation);
      streamStartTime = new Date();
    });
  
    call.on('error', (err: grpcWeb.Error) => {
      const responseMetaInformation = this.responseMetaInformation(streamStartTime, true);
      if (err && err.code !== 1) {
        this.emit(GRPCEventType.ERROR, this.betterErr(err), responseMetaInformation);
  
        if (err.code === 2 || err.code === 14) { // Stream Removed.
          this.emit(GRPCEventType.END, call);
        }
      }
      streamStartTime = new Date();
    });
  
    call.on('end', () => {
      this.emit(GRPCEventType.END, this);
    });
  }

  /**
   * Handle unary response
   * @param err
   * @param response
   * @param requestStartTime
   */
  private handleUnaryResponse(err: grpcWeb.Error, response: any, requestStartTime?: Date) {
    const responseMetaInformation = this.responseMetaInformation(requestStartTime);
  
    // Client side streaming handler
    if (err) {
      // Request cancelled do nothing
      if (err.code === 1) {
        return;
      } else {
        this.emit(GRPCEventType.ERROR, this.betterErr(err), responseMetaInformation);
      }
    } else {
      this.emit(GRPCEventType.DATA, response, responseMetaInformation);
    }
    this.emit(GRPCEventType.END);
  }

  private betterErr(err: grpcWeb.Error) : Error {
    return new Error(`full url: ${this._fullUrl}, code: ${err.code}, err: ${err.message}`)
  }

  /**
   * Response meta information
   * @param startTime
   * @param stream
   */
  private responseMetaInformation(startTime?: Date, stream?: boolean) {
    const responseDate = new Date();
  
    return {
      responseTime: startTime && (responseDate.getTime() - startTime.getTime()) / 1000,
      stream,
    };
  }

  /**
   * Parse JSON to request inputs / metadata
   * @param data
   * @param userMetadata
   */
  private parseRequestInfo(data: string, userMetadata?: string): { inputs: object, metadata: object } {
    let inputs = {};
    let metadata: {[key: string]: any} = {};

    try {
      inputs = JSON.parse(data || "{}")
    } catch (e) {
      e.message = "Couldn't parse JSON inputs Invalid json";
      this.emit(GRPCEventType.ERROR, e, {});
      this.emit(GRPCEventType.END);
      throw new Error(e);
    }

    if (userMetadata) {
      try {
        metadata = JSON.parse(userMetadata || "{}")
      } catch (e) {
        e.message = "Couldn't parse JSON metadata Invalid json";
        this.emit(GRPCEventType.ERROR, e, {});
        this.emit(GRPCEventType.END);
        throw new Error(e);
      }
    }

    return { inputs, metadata };
  }
}
