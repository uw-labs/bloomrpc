import { ResponseError } from './responseError';
import { ServiceError } from 'grpc';
import { loadSync, Root } from 'protobufjs/minimal';
import { getImportPaths } from '../storage';

import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

interface Any {
  type_url: string;
  value: Uint8Array
}

interface Status {
  code: number;
  message: string
  details: Any[]
}

const fsReaddir = util.promisify(fs.readdir);
const fsStat = util.promisify(fs.stat);

const DEFAULT_ERROR_PROTO_PATH = path.join(process.cwd(), "app/proto");

export async function parse(serviceError: ServiceError): Promise<ResponseError> {
  const statusDetailsBinary = getStatusDetailsBinary(serviceError);
  if (!statusDetailsBinary) {
    return Promise.reject('grpc-status-details-bin is missing');
  }
  const root = await getRoot([...getImportPaths(), DEFAULT_ERROR_PROTO_PATH]);
  const {code, message, details} = parseStatus(root, statusDetailsBinary);
  return {
    code,
    message,
    details: details.map((detailsEntry) => {
      return decodeDetailsEntry(root, detailsEntry)
    })
  };
}

function getStatusDetailsBinary(serviceError: ServiceError): Uint8Array {
  if (!serviceError.metadata) {
    throw new Error('Service error does not contain metadata');
  }
  return serviceError.metadata.get('grpc-status-details-bin')[0] as Uint8Array;
}

function parseStatus(root: Root, statusDetailsBinary: Uint8Array): Status {
  return root.lookupType('google.rpc.Status').decode(statusDetailsBinary) as any as Status;
}

function decodeDetailsEntry(root: Root, entry: Any): any {
  const type = entry.type_url.split('/')[1];
  try {
    return root.lookupType(type).decode(entry.value);
  } catch (e) {
    return {message: `Failed to parse type: ${type}`}
  }
}

/**
 * Gets protobufjs root with loaded proto files.
 * @param importPaths
 */
async function getRoot(importPaths: string[]): Promise<Root> {
  const dirs: string[][] = await Promise.all(importPaths.filter((dir) => dir).map((dir) => walk(dir)));
  const files = Array.from(new Set<string>(dirs.reduce((flatten, arr) => [...flatten, ...arr])));
  const protoFiles = files.filter((file) => file && file.endsWith('.proto'));
  return loadSync(protoFiles);
}

/**
 * Recursively traverses directory
 * @param dirPath absolute directory path
 * @returns array of absolute file path
 */
async function walk(dirPath: string, fileList: string[] = []): Promise<string[]> {
  const files = await fsReaddir(dirPath);

  for (let file of files) {
    const filepath = path.join(dirPath, file);
    const stat = await fsStat(filepath);

    if (stat.isDirectory()) {
      fileList = await walk(filepath, fileList);
    } else {
      fileList.push(filepath);
    }
  }

  return fileList;
}