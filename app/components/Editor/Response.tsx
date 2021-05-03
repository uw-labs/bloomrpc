import * as React from 'react';
import { Tabs } from 'antd';
import { Viewer } from './Viewer';
import { EditorResponse } from "./Editor";

interface ResponseProps {
  theme: string
  streamResponse: EditorResponse[]
  response: EditorResponse
}

export function Response({response, streamResponse, theme}: ResponseProps) {
  const defaultKey = `responseTab`;
  return (
    <>
      <Tabs
        defaultActiveKey={defaultKey}
        tabPosition={"top"}
        style={{width: "100%", height: "height: calc(100vh - 181px)"}}
      >
        {streamResponse.length === 0 && (
          <Tabs.TabPane tab={"Response"} key={"unaryResponse"}>
              <Viewer
                  theme={theme}
                  output={response.output}
                  responseTime={response.responseTime}
                  emptyContent={(
                    <div style={{position: "relative", height: "325px"}}>
                      <div style={styles.introContainer}>
                        <img src={require('./../../../resources/blue/128x128.png')} style={{ opacity: 0.1, pointerEvents: "none", userSelect: "none" }}/>
                        <h1 style={styles.introTitle}>Hit the play button to get a response here</h1>
                      </div>
                    </div>
                )}
              />
          </Tabs.TabPane>
        )}
        {streamResponse.map((data, key) => (
          <Tabs.TabPane tab={`Stream ${key + 1}`} key={`response-${key}`}>
            <Viewer
                theme={theme}
                output={data.output}
                responseTime={data.responseTime}
            />
          </Tabs.TabPane>
        ))}
      </Tabs>
    </>
  )
}

const styles = {
  introContainer: {
    textAlign: "center" as "center",
    margin: "20% 30% auto",
    width: "45%",
    position: "absolute" as "absolute",
    zIndex: 7,
  },
  introTitle: {
    userSelect: "none" as "none",
    color: "rgba(17, 112, 134, 0.58)",
    fontSize: "25px",
    top: "120px",
  },
}
