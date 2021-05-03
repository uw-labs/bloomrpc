import * as React from 'react';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import AceEditor from 'react-ace';
import * as Mousetrap from 'mousetrap';
import 'mousetrap/plugins/global-bind/mousetrap-global-bind';
import { Input } from 'antd';
import styled from 'styled-components'

interface ResponseProps {
  theme: string
  output: string,
  responseTime?: number
  emptyContent?: Node | Element | JSX.Element
}


const StyledAceEditor = styled(AceEditor)`
  background: ${props => props.theme.backgroundLight} !important;
`

const StyledResponseTime = styled.div`
  user-select: none;
  font-size: 11px;
  padding: 3px 7px;
  position: absolute;
  top: 5px;
  right: 0px;
  z-index: 30;
  color: ${props=>props.theme.primary};
`

export function Viewer({ output, responseTime, emptyContent, theme }: ResponseProps) {
  const editorRef: any = useRef(null);
  const inputSearch: any = useRef(null);
  const [showFind, setShowFind] = useState(false);

  useEffect(() => {
    Mousetrap.bindGlobal(['command+f', 'ctrl+f'], () => {
      setShowFind(!showFind);
      return false;
    });

    return () => {
      Mousetrap.unbind(['command+f', 'ctrl+f'], 'keyup');
      Mousetrap.unbind(['command+f', 'ctrl+f'], 'keydown');
    }
  });

  return (
    <div style={styles.responseContainer}>
      <Input
        ref={inputSearch}
        name="search"
        autoFocus={showFind}
        className={`find-match ${!showFind ? 'hide' : ''}`}
        placeholder={"Search match"}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          editorRef.current.editor.findAll(e.target.value, {
            backwards: false,
            wrap: true,
            caseSensitive: false,
            wholeWord: false,
            regExp: true,
          });
        }}/>

      {!output && emptyContent}

      { responseTime && (
          <StyledResponseTime>
            {responseTime.toFixed(3)}s
          </StyledResponseTime>
      )}

      {output && (
        <StyledAceEditor
          ref={editorRef}
          className={"response-edit"}
          width={"100%"}
          height={"calc(100vh - 188px)"}
          mode="json"
          name="output"
          theme={theme === 'white' ? "textmate" : "monokai"}
          fontSize={13}
          showPrintMargin={false}
          wrapEnabled
          showGutter
          readOnly
          highlightActiveLine={false}
          value={output}
          onLoad={(editor: any) => {
            editor.renderer.$cursorLayer.element.style.display = "none";
            editor.$blockScrolling = Infinity;
          }}
          commands={[{
            name: 'find',
            bindKey: { win: 'Ctrl-f', mac: 'Command-f' }, //key combination used for the command.
            exec: () => {
              setShowFind(!showFind);
              inputSearch.current.focus();
            }
          }]}
          setOptions={{
            useWorker: true,
            showLineNumbers: false,
            highlightGutterLine: false,
            fixedWidthGutter: true,
            tabSize: 1,
            displayIndentGuides: false
          }}
        />
      )}
    </div>
  )
}

const styles = {
  responseContainer: {
    position: "relative" as "relative",
  },
  responseTime: {
    userSelect: "none" as "none",
    fontSize: 11,
    padding: "3px 7px",
    position: "absolute" as "absolute",
    top: "5px",
    right: "0px",
    zIndex: 30,
  }
};
