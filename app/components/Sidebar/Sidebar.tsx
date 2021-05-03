import * as React from 'react';
import { useEffect, useState } from "react";
import { Button, Icon, Modal, Tooltip, Tree, Switch } from 'antd';
import { Badge } from '../Badge/Badge';
import { OnProtoUpload, ProtoFile, ProtoService, importProtos } from '../../behaviour';
import { PathResolution } from "./PathResolution";
import { getImportPaths } from "../../storage";
import styled from 'styled-components'


interface SidebarProps {
  protos: ProtoFile[]
  onMethodSelected: (methodName: string, protoService: ProtoService) => void
  onMethodDoubleClick: (methodName: string, protoService: ProtoService) => void
  onProtoUpload: OnProtoUpload
  onDeleteAll: () => void
  onReload: () => void
  changeTheme: () => void
  theme: string
}

const StyledTooltipIcon = styled(Icon)`
  font-size: 22px;
  margin-right: 10px;
  border-radius: 50%;
  cursor: pointer;
  background: ${props => props.theme.background};
  color: ${props => {
    return props.theme.primary
  }};
`

const TitleBox = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 14px;
  padding-bottom: 4px;
  padding-left: 10px;

  border-bottom: 1px solid ${props => props.theme.border.bottom};
`

const Title = styled.h3`
  color: ${props=> props.theme.h3.color}
`
const OptionsContainer = styled.div`
  padding: 3px 6px;
  display: flex;
  align-content: space-between;
  border-bottom: 1px solid ${props => props.theme.border.bottom};
`

const OptionsLeft = styled.div`
  width: 50%;
`

const OptionsRight = styled.div`
  width: 50%;
  text-align: right;
  justify-content: flex-end;
  align-items: center;
  display: flex;
`

const GhostButton = styled(Button)`
  height: 22;
  padding-right: 5px;
  padding-left: 5px;
  border: none;
  color: ${props=>props.theme.primary};
`

const IconBtn = styled(Icon)`
  cursor: pointer;
  color: ${props=>props.theme.icon.color};
`


const IconBtnRed = styled(IconBtn)`
  color: ${props=>props.theme.icon.warning};
`

const Protos = styled.div`
  overflow: auto;
  maxHeight: calc(100vh - 85px);
  height: 100%;
`

const ThemeSwitch = styled(Switch)`
  margin-right: 10px;
  color: ${props=>props.theme.switch.color};
  background: ${props=>props.theme.switch.background};
  transition: none;
`

const StyledTreeNode = styled(Tree.TreeNode)``

const ThemeTooltipContainer = styled.div`
  display: flex;
  align-items: center;
`

export function Sidebar({ protos, onMethodSelected, onProtoUpload, onDeleteAll, onReload, changeTheme, theme, onMethodDoubleClick }: SidebarProps) {

  const [importPaths, setImportPaths] = useState<string[]>([""]);
  const [importPathVisible, setImportPathsVisible] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterMatch, setFilterMatch] = useState<string|null>(null);

  useEffect(() => {
    setImportPaths(getImportPaths());
  }, []);

  /**
   * An internal function to retrieve protobuff from the selected key
   * @param selected The selected key from the directory tree
   */
  function processSelectedKey(selected: string | undefined) {
    // We handle only methods.
    if (!selected || !selected.includes("method:")) {
      return undefined;
    }

    const fragments = selected.split('||');
    const fileName = fragments[0];
    const methodName = fragments[1].replace('method:', '');
    const serviceName = fragments[2].replace('service:', '');

    const protodef = protos.find((protoFile) => {
      const match = Object.keys(protoFile.services).find(
        (service) => service === serviceName &&
          fileName === protoFile.services[serviceName].proto.filePath
      );
      return Boolean(match);
    });

    if (!protodef) {
      return undefined;
    }
    return {methodName, protodef, serviceName}
  }

  function toggleFilter() {
    setFilterVisible(!filterVisible);
    if (filterVisible) {
      setFilterMatch(null);
    }
  }

  return (
    <>
      <TitleBox>
        <Title>Protos</Title>
        <ThemeTooltipContainer>
          <ThemeSwitch 
            checkedChildren={<Icon type="check" />}
            unCheckedChildren={<Icon type="close" />}
            onClick={changeTheme}
          />
          <Tooltip placement="bottom" title="Import protos">
            <StyledTooltipIcon
              onClick={() => {
                importProtos(onProtoUpload, importPaths)
              }}
              type="plus-circle"
            />
          </Tooltip>
        </ThemeTooltipContainer>

      </TitleBox>
      <OptionsContainer>
        <OptionsLeft>
          <Tooltip title="Reload" placement="bottomLeft" align={{offset: [-8, 0]}}>
            <GhostButton type="ghost" onClick={onReload}>
              <IconBtn type="reload"/>
            </GhostButton>
          </Tooltip>

          <Tooltip title="Import Paths" placement="bottomLeft" align={{offset: [-8, 0]}}>
            <GhostButton type="ghost" onClick={() => setImportPathsVisible(true)}>
              <IconBtn type="file-search"/>
            </GhostButton>
          </Tooltip>

          <Tooltip title="Filter method names" placement="bottomLeft" align={{offset: [-8, 0]}}>
            <Button
              type="ghost"
              style={{height: 24, paddingRight: 5, paddingLeft: 5, marginLeft: 5}}
              onClick={() => toggleFilter()}
            >
              <Icon type="filter" style={{cursor: "pointer", color: "#1d93e6"}}/>
            </Button>
          </Tooltip>

          <Modal
              title={(
                  <div>
                    <Title> <IconBtn type="file-search" /> Import Paths </Title>
                  </div>
              )}
              visible={importPathVisible}
              onCancel={() => setImportPathsVisible(false)}
              onOk={() => setImportPathsVisible(false)}
              bodyStyle={{padding: 0}}
              width={750}
              footer={[
                <Button key="back" onClick={() => setImportPathsVisible(false)}>Close</Button>
              ]}
          >
            <PathResolution
                onImportsChange={setImportPaths}
                importPaths={importPaths}
            />
          </Modal>

        </OptionsLeft>
        <OptionsRight>
          <Tooltip title="Delete all" placement="bottomRight" align={{offset: [10, 0]}}>
            <GhostButton type="ghost" onClick={onDeleteAll}>
              <IconBtnRed type="delete" />
            </GhostButton>
          </Tooltip>
        </OptionsRight>
      </OptionsContainer>
      <Protos>
        {protos.length > 0 && <Tree.DirectoryTree
          showIcon
          defaultExpandAll
          onSelect={async (selectedKeys) => {
            const selected = selectedKeys.pop();
            const protoDefinitions = processSelectedKey(selected);

            if (!protoDefinitions){
              return;
            }

            onMethodSelected(protoDefinitions.methodName, protoDefinitions.protodef.services[protoDefinitions.serviceName]);
          }}
          onDoubleClick={async (event, treeNode)=>{
            const selected = treeNode.props.eventKey;
            const protoDefinitions = processSelectedKey(selected);

            if (!protoDefinitions){
              return;
            }

            // if the original one table doesn't exist, then ignore it
            onMethodDoubleClick(protoDefinitions.methodName, protoDefinitions.protodef.services[protoDefinitions.serviceName])
          }}
        >
          {protos.map((proto) => (
            <StyledTreeNode
              icon={() => <Badge type="protoFile"> P </Badge>}
              title={proto.fileName}
              key={proto.fileName}
            >
              {Object.keys(proto.services).map((service) => (
                <StyledTreeNode
                  icon={<Badge type="service"> S </Badge>}
                  title={service}
                  key={`${proto.fileName}-${service}`}
                >

                  {proto.services[service].methodsName
                    .filter((name) => {
                      if (filterMatch === null) return true;
                      return name.toLowerCase().includes(filterMatch.toLowerCase());
                    })
                    .map((method: any) => (
                      <Tree.TreeNode
                        icon={<Badge type="method"> M </Badge>}
                        title={method}
                        key={`${proto.proto.filePath}||method:${method}||service:${service}`}
                      >
                    </Tree.TreeNode>
                  ))}
                </StyledTreeNode>
              ))}
            </StyledTreeNode>
          ))}
        </Tree.DirectoryTree>}
      </Protos>
    </>
  );
}