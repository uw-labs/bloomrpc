import { EventEmitter } from "events";
import { credentials, Metadata, ServiceError } from "grpc";
import { ProtoInfo } from './protoInfo';
import * as grpc from 'grpc';
import * as fs from "fs";
import { Certificate } from "./importCertificates";
import { parse as parseError } from './grpcErrorParser';

export interface GRPCRequestInfo {
  url: string;
  protoInfo: ProtoInfo;
  metadata: string;
  inputs: string;
  interactive?: boolean;
  tlsCertificate?: Certificate
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
    Object.keys(metadata).forEach(key => {
      md.add(key, metadata[key]);
    });

    // Gather method information
    const methodDefinition = this.protoInfo.methodDef();

    // TODO: find proper type for call
    let call: any;

    if (methodDefinition.requestStream) {
      // Client side streaming
      call = this.clientStreaming(client, inputs, md);
    } else {
      // Unary call
      call = this.unaryCall(client, inputs, md);
    }

    // Server Streaming.
    if (methodDefinition.responseStream) {
      call.on('data', (data: object) => {
        this.emit(GRPCEventType.DATA, data, true);
      });

      call.on('error', (err: ServiceError) => {
        if (err && err.code !== 1) {
          this.emitError(err);

          if (err.code === 2 || err.code === 14) { // Stream Removed.
            this.emit(GRPCEventType.END, call);
          }
        }
      });

      call.on('end', () => {
        this.emit(GRPCEventType.END, this);
      });
    }

    this._call = call;

    this.on(GRPCEventType.END, () => {
      client.close();
    });

    return this;
  }

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

  cancel() {
    if (this._call) {
      this._call.cancel();
      this.emit(GRPCEventType.END);
    }
  }

  commitStream() {
    if (this._call) {
      this._call.end();
    }
  }

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
      creds = credentials.createSsl(
          fs.readFileSync(this.tlsCertificate.rootCert.filePath),
          this.tlsCertificate.privateKey && fs.readFileSync(this.tlsCertificate.privateKey.filePath),
          this.tlsCertificate.certChain && fs.readFileSync(this.tlsCertificate.certChain.filePath),
      );
    }

    return new serviceClient(this.url, creds, options);
  }

  private clientStreaming(client: any, inputs: any, md: Metadata) {
    const call = client[this.protoInfo.methodName](md, this.handleUnaryResponse.bind(this));

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

  private unaryCall(client: any, inputs: any, md: Metadata) {
    return client[this.protoInfo.methodName](inputs, md, this.handleUnaryResponse.bind(this));
  }

  private handleUnaryResponse(err: ServiceError, response: any) {
    // Client side streaming handler
    if (err) {
      // Request cancelled do nothing
      if (err.code === 1) {
        return;
      } else {
        this.emitError(err);
      }
    } else {
      this.emit(GRPCEventType.DATA, response);
    }
    this.emit(GRPCEventType.END, this);
  }

  private parseRequestInfo(data: string, userMetadata?: string): { inputs: object, metadata: object } {
    let inputs = {};
    let metadata: {[key: string]: any} = {};

    try {
      inputs = JSON.parse(data || "{}")
    } catch (e) {
      e.message = "Couldn't parse JSON inputs Invalid json";
      this.emit(GRPCEventType.ERROR, e);
      this.emit(GRPCEventType.END);
      throw new Error(e);
    }

    if (userMetadata) {
      try {
        metadata = JSON.parse(userMetadata || "{}")
      } catch (e) {
        e.message = "Couldn't parse JSON metadata Invalid json";
        this.emit(GRPCEventType.ERROR, e);
        this.emit(GRPCEventType.END);
        throw new Error(e);
      }
    }

    return { inputs, metadata };
  }

  private emitError(serviceError: ServiceError) {
    parseError(serviceError).then((errorObject) => {
      this.emit(GRPCEventType.ERROR, errorObject)
    }).catch((e) => {
      console.warn(e);
      this.emit(GRPCEventType.ERROR, { message: serviceError.message, code: serviceError.code });
    });
  }
}