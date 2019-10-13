import React from 'react'
import CodeMirror from '../../lib/CodeMirror'

const defaultCodeMirrorOptions: CodeMirror.EditorConfiguration = {
  lineWrapping: true,
  lineNumbers: true,
  mode: 'markdown'
}

interface CodeEditorProps {
  value: string
  onChange: (
    newValue: string,
    change: CodeMirror.EditorChangeLinkedList
  ) => void
  codeMirrorRef?: (codeMirror: CodeMirror.EditorFromTextArea) => void
}

class CodeEditor extends React.Component<CodeEditorProps> {
  textAreaRef = React.createRef<HTMLTextAreaElement>()
  codeMirror?: CodeMirror.EditorFromTextArea

  componentDidMount() {
    this.codeMirror = CodeMirror.fromTextArea(
      this.textAreaRef.current!,
      defaultCodeMirrorOptions
    )
    this.codeMirror.on('change', this.handleCodeMirrorChange)
    window.addEventListener('codemirror-mode-load', this.reloadOptions)
    if (this.props.codeMirrorRef != null) {
      this.props.codeMirrorRef(this.codeMirror)
    }
  }

  reloadOptions = () => {
    if (this.codeMirror != null) {
      this.codeMirror.setOption('mode', this.codeMirror.getOption('mode'))
    }
  }

  componentDidUpdate() {
    if (
      this.codeMirror != null &&
      this.props.value !== this.codeMirror.getValue()
    ) {
      this.codeMirror.setValue(this.props.value)
    }
  }

  componentWillUnmount() {
    if (this.codeMirror != null) {
      this.codeMirror.toTextArea()
    }
    window.removeEventListener('codemirror-mode-load', this.reloadOptions)
  }

  handleCodeMirrorChange = (
    editor: CodeMirror.Editor,
    change: CodeMirror.EditorChangeLinkedList
  ) => {
    if (change.origin !== 'setValue') {
      this.props.onChange(editor.getValue(), change)
    }
  }

  render() {
    return <textarea ref={this.textAreaRef} defaultValue={this.props.value} />
  }
}

export default CodeEditor
