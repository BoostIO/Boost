import React, { PropTypes } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import styled from 'styled-components'
import TagSelect from './TagSelect'
import moment from 'moment'
import MarkdownEditor from 'components/MarkdownEditor'
import dataAPI from 'main/lib/dataAPI'
import { Set } from 'immutable'
import markdown from 'lib/markdown'

const { remote } = require('electron')

const Root = styled.div`
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
`

const StatusBar = styled.div`
  width: 100%;
  height: 30px;
  display: flex;
`

const StatusBarLeft = styled.div`
  flex: 1;
  padding: 0 5px;
`

const StatusBarRight = styled.div`
  font-size: 12px;
  line-height: 30px;
  color: ${p => p.theme.inactiveColor};
  padding: 0 10px;
`

const BodyEditor = styled(MarkdownEditor)`
  position: relative;
  flex: 1;
  .CodeEditor {
    border-top: ${p => p.theme.border};
  }
`
class Detail extends React.Component {
  constructor (props) {
    super(props)

    let { note } = props

    this.state = {
      tags: note.get('tags'),
      content: note.get('content')
    }

    this.queueTimer = null
  }

  componentWillReceiveProps (nextProps) {
    const nextNoteKey = nextProps.noteKey
    const { noteKey } = this.props

    // If note switched, save current note and refresh inputs
    if (nextNoteKey !== noteKey) {
      if (noteKey != null) {
        this.dispatchUpdate()
      }

      this.tagSelect.resetInput()
      this.setState({
        tags: new Set(nextProps.note.get('tags')),
        content: nextProps.note.get('content')
      })
    } else {
      if (!nextProps.note.get('tags').equals(this.props.note.get('tags'))) {
        this.setState({
          tags: new Set(nextProps.note.get('tags'))
        })
      }
    }
  }

  componentDidMount () {
    window.addEventListener('detail:focus', this.handleDetailFocus)
    window.addEventListener('detail:focus-tag-select', this.handleDetailFocusTagSelect)
    window.addEventListener('detail:set-single-layout', this.handleDetailSetSingleLayout)
    window.addEventListener('detail:set-two-pane-layout', this.handleDetailSetTwoPaneLayout)
    window.addEventListener('detail:toggle-layout', this.handleDetailToggleLayout)
  }

  componentWillUnmount () {
    if (this.queueTimer != null) {
      this.dispatchUpdate()
    }

    window.removeEventListener('detail:focus', this.handleDetailFocus)
    window.removeEventListener('detail:focus-tag-select', this.handleDetailFocusTagSelect)
    window.removeEventListener('detail:set-single-layout', this.handleDetailSetSingleLayout)
    window.removeEventListener('detail:set-two-pane-layout', this.handleDetailSetTwoPaneLayout)
    window.removeEventListener('detail:toggle-layout', this.handleDetailToggleLayout)
  }

  handleContentChange = e => {
    this.setState({
      content: this.editor.value
    }, () => {
      this.setDispatchTimer()
    })
  }

  handleTagChange = newTags => {
    this.setState({
      tags: newTags
    }, () => {
      this.setDispatchTimer()
    })
  }

  handleDetailFocus = e => {
    this.focusEditor()
  }

  handleDetailFocusTagSelect = e => {
    this.tagSelect.focus()
  }

  handleDetailSetSingleLayout = e => {
    this.setLayout('SINGLE')
  }

  handleDetailSetTwoPaneLayout = e => {
    this.setLayout('TWO_PANE')
  }

  handleDetailToggleLayout = e => {
    const { status } = this.props

    const nextLayout = status.get('editorMode') === 'SINGLE'
      ? 'TWO_PANE'
      : 'SINGLE'

    this.setLayout(nextLayout)
  }

  setLayout (nextLayout) {
    const { store } = this.context
    const { status } = this.props
    if (nextLayout === status.get('editorMode')) {
      return
    }

    const currentWindow = remote.getCurrentWindow()
    const [, windowHeight] = currentWindow.getSize()
    const nextEditorWidth = nextLayout === 'SINGLE'
      ? status.get('editorSingleWidth')
      : status.get('editorDoubleWidth')
    const nextWidth = status.get('navWidth') + status.get('noteListWidth') + nextEditorWidth + 2
    currentWindow.setSize(nextWidth, windowHeight)

    store.dispatch({
      type: 'UPDATE_STATUS',
      payload: {
        status: status.set('editorMode', nextLayout)
      }
    })
  }

  dispatchUpdate () {
    const { noteKey, note } = this.props
    const { router, store } = this.context

    const isContentChanged = note.get('content') !== this.state.content
    const areTagsChanged = !note.get('tags').equals(new Set(this.state.tags))

    if (noteKey == null || (!isContentChanged && !areTagsChanged)) {
      return false
    }

    const parsed = markdown.parse(this.state.content)
    const meta = {
      title: parsed.data.title,
      preview: parsed.data.preview
    }

    const input = {
      meta,
      tags: this.state.tags.toArray(),
      content: this.state.content
    }

    dataAPI
      .updateNote(router.params.storageName, noteKey, input)
      .then(res => {
        store.dispatch({
          type: 'UPDATE_NOTE',
          payload: {
            storageName: router.params.storageName,
            noteId: res.id,
            note: res.note
          }
        })
      })
  }

  setDispatchTimer () {
    this.invalidateDispatchTimer()
    this.queueTimer = window.setTimeout(() => {
      this.queueTimer = null
      this.dispatchUpdate()
    }, 1000)
  }

  invalidateDispatchTimer () {
    window.clearTimeout(this.queueTimer)
  }

  focusEditor () {
    this.editor.focus()
  }

  render () {
    const { note, noteKey, config, status } = this.props
    const { router } = this.context

    return (
      <Root>
        <StatusBar>
          <StatusBarLeft>
            <TagSelect
              ref={c => (this.tagSelect = c)}
              value={this.state.tags}
              onChange={this.handleTagChange}
            />
          </StatusBarLeft>
          <StatusBarRight>{moment(note.get('updatedAt')).fromNow()}</StatusBarRight>
        </StatusBar>
        <BodyEditor
          innerRef={c => (this.editor = c)}
          value={this.state.content}
          onChange={this.handleContentChange}
          docKey={`${router.params.storageName}/${noteKey}`}
          mode={status.get('editorMode')}
          previewTheme={config.get('theme')}
          fontSize={config.get('previewFontSize')}
          fontFamily={config.get('previewFontFamily')}
          codeBlockTheme={config.get('previewCodeBlockTheme')}
          codeBlockFontFamily={config.get('previewCodeBlockFontFamily')}
          editorFontSize={config.get('editorFontSize')}
          editorFontFamily={config.get('editorFontFamily')}
          editorTheme={config.get('editorTheme')}
          indentStyle={config.get('editorIndentStyle')}
          indentSize={config.get('editorIndentSize')}
        />
      </Root>
    )
  }
}

Detail.propTypes = {
  noteKey: PropTypes.string,
  note: PropTypes.shape({
  }),
  config: ImmutablePropTypes.mapContains({

  })
}

Detail.contextTypes = {
  router: PropTypes.shape({
    location: PropTypes.shape()
  }),
  store: PropTypes.shape({
    dispatch: PropTypes.func
  })
}

export default Detail
