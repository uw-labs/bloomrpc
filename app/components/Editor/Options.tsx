import * as React from 'react';
import { Button, Icon, Tooltip, Switch, Modal, Menu, Dropdown } from 'antd';
import { setInteractive, setProtoVisibility, setGrpcWeb } from './actions';
import { EditorAction } from './Editor';
import { Theme } from '../../App'
import {useState} from "react";
import {TLSManager} from "./TLSManager";
import { ProtoInfo, Certificate } from '../../behaviour';
import styled from 'styled-components'
interface OptionsProps {
  protoInfo: ProtoInfo
  dispatch: React.Dispatch<EditorAction>
  interactiveChecked: boolean
  grpcWebChecked: boolean
  onInteractiveChange?: (chcked: boolean) => void
  tlsSelected?: Certificate
  onTLSSelected?: (selected: Certificate) => void
  onClickExport?: () => void
}

const StyledModalTitle = styled.div`
  color: ${props=>props.theme.primary} !important;
  background: ${props=>props.theme.background} !important;
`

const StyledModal = styled(Modal)`
  color: ${props=>props.theme.primary} !important;
`

const ViewProtoBtn = styled(Button)`
  color: ${props=>props.theme.primary} !important;
  background: ${props=>props.theme.backgroundDark} !important;
  transition: none;
  &:hover {
    background: ${props=>props.theme.backgroundLight} !important;
  }
`

const StyledSwitch = styled(Switch)`
  color: ${props=>props.theme.switch.color} !important;
  background: ${props=>props.theme.switch.background} !important;
  transition: none;
`

const TLSButton = styled.span`
  cursor: pointer;
  margin-left: 10px;
  padding: 1px 10px;
  border-radius: 3px;
  font-weight: 500;
  font-size: 13px;
  border: 1px solid ${props=>props.theme.border.all};
`

type Props = {
  theme: Theme,
  tlsSelected: boolean
}

const LockIcon = styled(Icon)`
  font-size: 18px;
  color: ${(props: Props) => props.tlsSelected ? props.theme.icon.success : props.theme.icon.warning}
`
export function Options({ protoInfo, dispatch, grpcWebChecked, interactiveChecked, onInteractiveChange, tlsSelected, onTLSSelected, onClickExport }: OptionsProps) {

  const [tlsModalVisible, setTlsModalVisible] = useState(false);

  return (
    <div style={{...styles.optionContainer, ...styles.inline}}>

      <div style={{paddingLeft: 15}}>
          <div style={{
            display: "flex",
            alignItems: "center",
          }}>
            <Tooltip placement="bottom" title={tlsSelected ? "Secure Connection" : "Unsecure Connection"}>
              <LockIcon
                  tlsSelected={!!tlsSelected}
                  type={tlsSelected ? "lock" : "unlock"}
                  style={{
                    fontSize: 18,
                  }}
              />
            </Tooltip>
            <TLSButton
              onClick={() => setTlsModalVisible(true)}
            >
              <span>TLS</span>
            </TLSButton>
          </div>

          <StyledModal
              title={(
                  <StyledModalTitle>
                    <Icon type="lock" />
                    <span style={{marginLeft: 10}}> TLS / SSL Manager </span>
                  </StyledModalTitle>
              )}
              visible={tlsModalVisible}
              onCancel={() => setTlsModalVisible(false)}
              onOk={() => setTlsModalVisible(false)}
              bodyStyle={{padding: 0}}
              width={750}
              okText={"Done"}
              cancelText={"Close"}
          >
            <TLSManager
                selected={tlsSelected}
                onSelected={onTLSSelected}
            />
          </StyledModal>
      </div>

      <div style={{ ...styles.inline }}>
        <Dropdown overlay={(
            <Menu>
              <Menu.Item key="0">
                <a onClick={(e) => {
                  e.preventDefault();
                  onClickExport && onClickExport()
                }}>Export response</a>
              </Menu.Item>
            </Menu>
        )} trigger={['click']}>
          <div style={{ marginRight: 5, marginTop: 2, cursor: 'pointer', color: "#b5b5b5"}} >
            <Icon type="caret-down" />
          </div>
        </Dropdown>
        <div style={{paddingRight: 10}}>
          <StyledSwitch
            checkedChildren="WEB &nbsp;"
            defaultChecked={grpcWebChecked}
            unCheckedChildren="GRPC"
            onChange={(checked) => {
              dispatch(setGrpcWeb(checked));
            }}
          />
        </div>
        <div style={{paddingRight: 10}}>
          <StyledSwitch
            checkedChildren="Interactive"
            defaultChecked={interactiveChecked}
            unCheckedChildren="Manual &nbsp; &nbsp; &nbsp;"
            onChange={(checked) => {
              dispatch(setInteractive(checked));
              onInteractiveChange && onInteractiveChange(checked);
            }}
          />
        </div>

        <ViewProtoBtn
          icon="file-ppt"
          type="dashed"
          onClick={() => dispatch(setProtoVisibility(true))}
        >
          View Proto
        </ViewProtoBtn>
      </div>
    </div>
  )
}

const styles = {
  optionContainer: {
    width: "50%",
  },
  inline: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  }
};
