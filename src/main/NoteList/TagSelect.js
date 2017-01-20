import React, { PropTypes } from 'react'
import styled from 'styled-components'
import Octicon from 'components/Octicon'
import ImmutablePropTypes from 'react-immutable-proptypes'

const Root = styled.div`
  height: 30px;
  position: relative;
  align-items: center;
  .Octicon {
    fill: ${p => p.theme.inactiveColor};
    position: absolute;
    left: 2px;
    top: 7px;
    width: 16px;
  }
  .list {
    position: absolute;
    left: 10px;
    top: 4px;
    right: 0;
    display: flex;
    align-items: center;
    padding: 0 10px;
    overflow: auto;
  }
  .item {
    -webkit-user-select: none;
    margin: 0 2px;
    height: 22px;
    font-size: 13px;
    border: ${p => p.theme.border};
    line-height: 22px;
    padding: 0 6px;
    border-radius: 4px;
    cursor: default;
    color: ${p => p.theme.color};
    box-sizing: border-box;
    &:hover {
      background-color: ${p => p.theme.buttonHoverColor};
    }
  }
  input {
    box-sizing: border-box;
    margin: 0 2px;
    height: 22px;
    line-height: 22px;
    padding: 0;
    width: 100px;
    border: none;
    border-bottom: ${p => p.theme.border};
    color: ${p => p.theme.color};
    outline: none;
    font-size: 12px;
    background-color: transparent;
    &:focus {
      border-bottom: ${p => p.theme.activeBorder};
    }
  }
`

class TagSelect extends React.Component {
  constructor (props) {
    super(props)

    this.state = {
      newTag: ''
    }
  }

  componentDidMount () {
    this.value = this.props.value
  }

  componentWillReceiveProps (nextProps) {
    this.value = this.props.value
  }

  handleInputChange = e => {
    this.setState({
      newTag: e.target.value
    })
  }

  handleInputKeyDown = e => {
    switch (e.keyCode) {
      // Enter
      case 13:
        this.addTag()
        break
      // Backspace
      case 8:
        if (e.target.selectionStart === 0) {
          this.removeTag()
        }
        break
      // 9: Tab, 27: Esc
      case 9:
      case 27:
        this.setState({newTag: ''})
        e.preventDefault()
        window.dispatchEvent(new window.CustomEvent('detail:focus'))
    }
  }

  addTag () {
    let newTag = this.state.newTag.trim().replace(/\s/g, '_')
    if (newTag.length > 0) {
      this.setState({
        newTag: ''
      }, () => {
        const { onChange, value } = this.props
        let newValue = value.add(newTag)
        this.value = newValue
        if (onChange != null) onChange(newValue)
      })
    }
  }

  removeTag () {
    const { onChange, value } = this.props
    let newValue = value.slice(0, value.size - 1)
    this.value = newValue
    if (onChange != null) onChange(newValue)
  }

  resetInput () {
    this.setState({
      newTag: ''
    })
  }

  focus () {
    this.input.focus()
  }

  render () {
    const { value } = this.props

    const tagList = value
      .map(tag => {
        return <div className='item' key={tag}>
          {tag}
        </div>
      })
      .toArray()

    return (
      <Root>
        <Octicon className='Octicon' icon='tag' />
        <div className='list'>
          {tagList}
          <input
            ref={c => (this.input = c)}
            value={this.state.newTag}
            onChange={this.handleInputChange}
            onKeyDown={this.handleInputKeyDown}
            placeholder='Add Tags...'
          />
        </div>
      </Root>
    )
  }
}

TagSelect.propTypes = {
  onChange: PropTypes.func,
  value: ImmutablePropTypes.setOf(PropTypes.string)
}

export default TagSelect
