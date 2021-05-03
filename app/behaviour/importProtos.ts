import { remote } from 'electron';
import { fromFileName, mockRequestMethods, Proto, walkServices } from 'bloomrpc-mock';
import * as path from "path";
import { ProtoFile, ProtoService } from './protobuf';
import { Service } from 'protobufjs';

const commonProtosPath = [
  // @ts-ignore
  path.join(__static),
];

export type OnProtoUpload = (protoFiles: ProtoFile[], err?: Error) => void

/**
 * Upload protofiles
 * @param onProtoUploaded
 * @param importPaths
 */
export async function importProtos(onProtoUploaded: OnProtoUpload, importPaths?: string[]) {

  const openDialogResult = await remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Protos', extensions: ['proto'] },
    ]
  });

  const filePaths = openDialogResult.filePaths;

  if (!filePaths) {
    return;
  }
  await loadProtos(filePaths, importPaths, onProtoUploaded);
}

/**
 * Load protocol buffer files
 * @param filePaths
 * @param importPaths
 * @param onProtoUploaded
 */
export async function loadProtos(filePaths: string[], importPaths?: string[], onProtoUploaded?: OnProtoUpload): Promise<ProtoFile[]> {
  try {
    const protos = await Promise.all(filePaths.map((fileName) =>
      fromFileName(fileName, [
        ...(importPaths ? importPaths : []),
        ...commonProtosPath,
      ])
    ));

    const protoList = protos.reduce((list: ProtoFile[], proto: Proto) => {

      // Services with methods
      const services = parseServices(proto);
      // Proto file
      list.push({
        proto,
        fileName: proto.fileName.split(path.sep).pop() || "",
        services,
      });

      return list;
    }, []);
    onProtoUploaded && onProtoUploaded(protoList, undefined);
    return protoList;

  } catch (e) {
    console.error(e);
    onProtoUploaded && onProtoUploaded([], e);

    if (!onProtoUploaded) {
      throw e;
    }

    return [];
  }
}

/**
 * Parse Grpc services from root
 * @param proto
 */
function parseServices(proto: Proto) {

  const services: {[key: string]: ProtoService} = {};

  walkServices(proto, (service: Service, _: any, serviceName: string) => {
    const mocks = mockRequestMethods(service);
    services[serviceName] = {
      serviceName: serviceName,
      proto,
      methodsMocks: mocks,
      methodsName: Object.keys(mocks),
    };
  });

  return services;
}

export function importResolvePath(): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const openDialogResult = await remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
      properties: ['openDirectory'],
      filters: []
    });

    const filePaths = openDialogResult.filePaths;

    if (!filePaths) {
      return reject("No folder selected");
    }
    resolve(filePaths[0]);
  });
}
