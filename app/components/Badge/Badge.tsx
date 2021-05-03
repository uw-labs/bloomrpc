import * as React from 'react';
import styled from 'styled-components'

interface BadgeProps {
  type: "protoFile" | "service" | "method"
  children: Node | string | Element
}

const StyledBadge = styled.div<{type: BadgeProps["type"]}>`
  line-height: 15px;
  font-size: 11px;
  margin-top: 5px;
  margin-right: 7px;
  padding-bottom: 1px;
  border-radius: 50%;
  color: ${props =>  props.theme.badge.color[props.type]};
  background-color: ${props => props.theme.badge.background[props.type]};
`

export function Badge({ type, children }: BadgeProps) {
  return (
    <StyledBadge type={type}>{children}</StyledBadge>
  )
}