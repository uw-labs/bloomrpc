import * as React from 'react';
import { ProtoInfo } from '../../behaviour';
import styled from 'styled-components'

interface RequestTypeProps {
  protoInfo?: ProtoInfo
}

const StyledRequestType = styled.div`
  text-overflow: ellipsis;
  max-width: 125px;
  overflow: hidden;
  border-left: 1px solid ${props=>props.theme.border.left};
  white-space: nowrap;
  width: 100%;
  color: ${props=>props.theme.primary};
  background: ${props=>props.theme.backgroundDark};
  padding: 7px 8px;
  font-size: 11px;
  font-weight: 500;
`

export function RequestType({ protoInfo }: RequestTypeProps) {
  let reqType = "Unary Call";

  if (!protoInfo) {
    reqType = "Server Address";
  } else if (protoInfo.isServerStreaming() && protoInfo.isClientStreaming()) {
    reqType = "Bi-Directional";
  } else if (protoInfo.isServerStreaming()) {
    reqType = "Server Streaming";
  } else if (protoInfo.isClientStreaming()) {
    reqType = "Client Streaming";
  }

  return (
    <StyledRequestType>
      {reqType}
    </StyledRequestType>
  );
}