import * as React from 'react';
import { Icon, Input, Table, Tooltip } from "antd";
import { useState } from "react";
import { importResolvePath } from "../../behaviour";
import { storeImportPaths } from "../../storage";
import styled from 'styled-components'
import { Theme } from '../../App'

interface PathResolutionProps {
  onImportsChange?: (paths: string[]) => void
  importPaths: string[]
}

interface TablePath {
  value: string
}

type Props = {
  theme: Theme,
  fontSize: number
}

const StyledIcon = styled(Icon)`
  color: ${(props: Props)=>props.theme.icon.color};
  font-size: ${(props: Props )=>props.fontSize}px;
  cursor: pointer;
  margin-top: 5px;
`

const StyledColumn = styled(Table.Column)`
  color: ${(props)=>props.theme.primary};
  background: ${(props)=>props.theme.background};
`

const StyledInput = styled(Input.Search)``

export function PathResolution({ importPaths, onImportsChange }: PathResolutionProps) {
  const [pathValue, setPathStateValue] = useState("");
  const tablePaths = importPaths.map(importPath => ({
    value: importPath,
  }));

  return (
    <div>
      <Table
          dataSource={tablePaths}
          pagination={false}
          rowKey={(path) => path.value || "addPath"}
      >
        <StyledColumn
          title="Path"
          width={"90%"}
          key={"pathColumn"}
          render={(text, record: TablePath) => {
            return (
                <>
                {!record.value ? (
                    <StyledInput
                      value={pathValue}
                      placeholder={"Absolute path"}
                      enterButton={"..."}
                      autoFocus={pathValue === ""}
                      onChange={(e) => {
                        setPathStateValue(e.target.value);
                      }}
                      onSearch={async () => {
                        try {
                          const path = await importResolvePath();
                          if (path != null){
                          setPathStateValue(path);
                          addImportPath(path, importPaths, onImportsChange);
                        }
                        } catch (e) {
                          // No file selected.
                        }
                      }}
                    />
                ) : (
                    <span>{record.value}</span>
                )}
                </>
            );
          }}
        />

        <StyledColumn
            title=""
            key={"actionColumn"}
            render={(text, path: TablePath) => (
                <>
                  {path.value ? (
                      <Tooltip placement="top" title="Remove">
                        <StyledIcon
                            fontSize={16}
                            type="close"
                            onClick={() => removePath(path.value, importPaths, onImportsChange)}
                        />
                      </Tooltip>
                  ) : (
                      <Tooltip placement="top" title="Add">
                        <StyledIcon
                            fontSize={18}
                            type="plus"
                            onClick={() => {
                              const pathAdded = addImportPath(pathValue, importPaths, onImportsChange);
                              if (pathAdded) {
                                setPathStateValue("");
                              }
                            }}
                        />
                      </Tooltip>
                  )}
                </>
            )}
        />
      </Table>
    </div>
  );
}

function addImportPath(
  path: string,
  importPaths: string[],
  setImportPath?: (path: string[]) => void,
): boolean {
  if (path !== "" && importPaths.indexOf(path) === -1) {
    const paths = [...importPaths, path];
    setImportPath && setImportPath(paths);
    storeImportPaths(paths);
    return true;
  }

  return false;
}

function removePath(
  path: string,
  importPaths: string[],
  setImportPath?: (path: string[]) => void,
) {
  const newPaths = importPaths.filter(currentPath => currentPath !== path);
  setImportPath && setImportPath(newPaths);
  storeImportPaths(newPaths);
}
