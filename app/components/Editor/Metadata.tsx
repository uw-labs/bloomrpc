import * as React from 'react';
import { Icon } from 'antd';
import AceEditor from 'react-ace';
import Resizable from 're-resizable';
import { storeMetadata } from "../../storage";
import { useState } from "react";
import styled from 'styled-components';
interface MetadataProps {
  theme: string
  onClickMetadata: () => void,
  onMetadataChange: (value: string) => void,
  value: string,
}

const StyledMetadata = styled.div`
  color: ${props=>props.theme.primary};
  background: ${props=>props.theme.background};
  border-top: 1px solid ${props=>props.theme.border.top};
`

const StyledMetadataOption = styled.div`
  padding: 7px 10px;
  margin-bottom: 5px;
`

const OptionContainer = styled(Resizable)<{height: number}>`
  position: absolute !important;
  font-weight: 900;
  font-size: 13px;
  border-left: 1px solid ${props=>props.theme.border.left};
  z-index: 10;
  bottom: -38px;
  height: ${props => {
    return props.height;
  }}px !important;
`

const StyledAceEditor = styled(AceEditor)`
  background: ${props => props.theme.backgroundLight} !important;
`

export function Metadata({ onClickMetadata, onMetadataChange, value, theme }: MetadataProps) {
  const [height, setHeight] = useState(38);
  const visibile = height > 38;
  return (
    <OptionContainer
        height={height}
        size={{width: "100%", height: height}}
        maxHeight={500}
        minHeight={38}
        enable={{top:true, right:false, bottom:true, left:false, topRight:false, bottomRight:false, bottomLeft:false, topLeft:false}}
        onResizeStop={(e, direction, ref, d) => {
          setHeight(height + d.height);
        }}
    >
      <StyledMetadata>
        <StyledMetadataOption>
          <a
            href={"#"}
            style={styles.optionLink}
            onClick={() => {
              if (visibile) {
                setHeight(38)
              } else {
                setHeight(150);
              }
              onClickMetadata()
            }}
          > {visibile ? <Icon type="down"/> : <Icon type="up"/>} METADATA </a>
        </StyledMetadataOption>

        <div>
          <StyledAceEditor
            width={"100%"}
            height={`${height + 20}px`}
            mode="json"
            focus={visibile}
            theme={theme === 'white' ? "textmate" : "monokai"}
            fontSize={13}
            name="metadata"
            onChange={(value) => {
              storeMetadata(value);
              onMetadataChange(value);
            }}
            showPrintMargin={false}
            showGutter
            highlightActiveLine={false}
            value={value}
            setOptions={{
              useWorker: true
            }}
          />
        </div>
      </StyledMetadata>
    </OptionContainer>
  )
}

const styles = {
  optionLabel: {
    padding: "7px 10px",
    marginBottom: "5px"
  },
  optionLink: {
    textDecoration: "none",
  },
};