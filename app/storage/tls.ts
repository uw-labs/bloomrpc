// @ts-ignore
import * as Store from "electron-store";
import { Certificate } from "../behaviour";

const TLSStore = new Store({
  name: "tls",
});


const TLS_KEYS = {
  CERTIFICATES: 'certificates'
};


export function storeTLSList(certs: Certificate[]) {
  TLSStore.set(TLS_KEYS.CERTIFICATES, certs);
}

export function getTLSList() {
  return [{
    useServerCertificate: true,
    rootCert: { fileName: "Server Certificate", filePath: "" },
  }].concat(TLSStore.get(TLS_KEYS.CERTIFICATES, []));
}

export function clearTLS() {
  return TLSStore.clear();
}