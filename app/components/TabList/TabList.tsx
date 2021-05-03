import * as React from 'react';
import { useEffect } from 'react';
import { Tabs } from 'antd';
import { Editor, EditorEnvironment, EditorRequest } from '../Editor';
import { ProtoInfo, ProtoService } from '../../behaviour';
import { DraggableItem, DraggableTabs } from "./DraggableTabList";
import * as Mousetrap from 'mousetrap';
import 'mousetrap/plugins/global-bind/mousetrap-global-bind';
import styled from 'styled-components';

interface TabListProps {
  theme: string
  tabs: TabData[]
  activeKey?: string
  onChange?: (activeKey: string) => void
  onDelete?: (activeKey: string | React.MouseEvent<HTMLElement>) => void
  onEditorRequestChange?: (requestInfo: EditorTabRequest) => void
  onDragEnd: (indexes: {oldIndex: number, newIndex: number}) => void
  environmentList?: EditorEnvironment[],
  onEnvironmentChange?: () => void
}

export interface TabData {
  tabKey: string
  methodName: string
  service: ProtoService
  initialRequest?: EditorRequest,
}

const StyledTabPane = styled(Tabs.TabPane)`
  color: ${props=>props.theme.primary};
  background: ${props=>props.theme.background};
`

const StyledTabs = styled(Tabs)`
  color: ${props=>props.theme.primary} !important;
  background: ${props=>props.theme.background} !important;
  padding: 10px 0px 0px 20px;
  margin-bottom: 0px;
  height: 100%;
`

const StyledDraggableTabs = styled(DraggableTabs)`

`
export interface EditorTabRequest extends EditorRequest {
  id: string
}

export function TabList({ tabs, activeKey, onChange, onDelete, onDragEnd, onEditorRequestChange, environmentList, onEnvironmentChange, theme }: TabListProps) {
  const tabsWithMatchingKey =
    tabs.filter(tab => tab.tabKey === activeKey);

  const tabActiveKey = tabsWithMatchingKey.length === 0
    ? [...tabs.map(tab => tab.tabKey)].pop()
    : [...tabsWithMatchingKey.map(tab => tab.tabKey)].pop();

  useEffect(() => {
    Mousetrap.bindGlobal(['command+w', 'ctrl+w'], () => {
      if (tabActiveKey) {
        onDelete && onDelete(tabActiveKey);
      }
      return false;
    });

    return () => {
      Mousetrap.unbind(['command+w', 'ctrl+w']);
    }
  });

  return (
    <StyledTabs
      className={"draggable-tabs"}
      onEdit={(targetKey, action) => {
        if (action === "remove") {
          onDelete && onDelete(targetKey);
        }
      }}
      onChange={onChange}
      activeKey={tabActiveKey || "0"}
      hideAdd
      type="editable-card"
      renderTabBar={(props, DefaultTabBar: any) => {
        return (
            <StyledDraggableTabs
                onSortEnd={onDragEnd}
                lockAxis={"x"}
                axis={"x"}
                pressDelay={120}
            >
              <DefaultTabBar {...props}>
                {(node: any) => {
                  const nodeIndex = tabs.findIndex(tab => tab.tabKey === node.key);
                  const nodeTab = tabs.find(tab => tab.tabKey === node.key);
                  return (
                      <DraggableItem
                          active={nodeTab && nodeTab.tabKey === activeKey}
                          index={nodeIndex}
                          key={node.key}
                      >
                        {node}
                      </DraggableItem>
                  )
                }}
              </DefaultTabBar>
            </StyledDraggableTabs>
        )
      }}
    >
      {tabs.length === 0 ? (
        <StyledTabPane
          tab={"New Tab"}
          key={"0"}
          closable={false}
        >
          <Editor
            theme={theme}
            active={true}
            environmentList={environmentList}
            onEnvironmentListChange={onEnvironmentChange}
          />
        </StyledTabPane>
      ) : tabs.map((tab) => (
          <StyledTabPane
            tab={`${tab.service.serviceName}.${tab.methodName}`}
            key={tab.tabKey}
            closable={true}
          >
            <Editor
              theme={theme}
              active={tab.tabKey === activeKey}
              environmentList={environmentList}
              protoInfo={new ProtoInfo(tab.service, tab.methodName)}
              key={tab.tabKey}
              initialRequest={tab.initialRequest}
              onEnvironmentListChange={onEnvironmentChange}
              onRequestChange={(editorRequest: EditorRequest) => {
                onEditorRequestChange && onEditorRequestChange({
                  id: tab.tabKey,
                  ...editorRequest
                })
              }}
            />
          </StyledTabPane>
      ))}
    </StyledTabs>
  );
}