import React, { useEffect } from 'react'
import SideNavigator from './SideNavigator'
import Router from './Router'
import GlobalStyle from './GlobalStyle'
import { ThemeProvider } from 'styled-components'
import { defaultTheme } from '../lib/styled/themes'
import { StyledAppContainer } from './styled'
import ContextMenu from './ContextMenu'
import Dialog from './Dialog/Dialog'
import { useDb } from '../lib/db'
import TwoPaneLayout from './atoms/TwoPaneLayout'

const App = () => {
  const { initialize, initialized } = useDb()
  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <ThemeProvider theme={defaultTheme}>
      <StyledAppContainer>
        {initialized ? (
          <TwoPaneLayout
            defaultLeftWidth={160}
            left={<SideNavigator />}
            right={<Router />}
          />
        ) : (
          <div>Loading data</div>
        )}
        <GlobalStyle />
        <ContextMenu />
        <Dialog />
      </StyledAppContainer>
    </ThemeProvider>
  )
}

export default App
