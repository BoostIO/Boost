import React, { CSSProperties, useCallback, useMemo, useRef } from 'react'
import { mdiClose } from '@mdi/js'
import cc from 'classcat'
import { ModalElement, useModal } from '../../../lib/stores/modal'
import { isActiveElementAnInput } from '../../../lib/dom'
import { useGlobalKeyDownHandler } from '../../../lib/keyboard'
import styled from '../../../lib/styled'
import Button from '../../atoms/Button'
import VerticalScroller from '../../atoms/VerticalScroller'
import { useWindow } from '../../../lib/stores/window'
import { useEffectOnce } from 'react-use'

const Modal = () => {
  const { modals, closeLastModal } = useModal()

  const keydownHandler = useMemo(() => {
    return (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'escape' && !isActiveElementAnInput()) {
        closeLastModal()
      }
    }
  }, [closeLastModal])
  useGlobalKeyDownHandler(keydownHandler)

  if (modals.length === 0) return null

  return (
    <Container
      className={cc([
        'modal',
        modals.length === 1 && modals[0].position != null && 'modal--context',
      ])}
    >
      {modals.map((modal, i) => {
        if (modal.position != null) {
          return (
            <ContextModalItem
              key={`modal-${i}`}
              modal={modal}
              closeModal={closeLastModal}
            />
          )
        }

        return (
          <ModalItem
            key={`modal-${i}`}
            modal={modal}
            closeModal={closeLastModal}
          />
        )
      })}
    </Container>
  )
}

const ContextModalItem = ({
  closeModal,
  modal,
}: {
  closeModal: () => void
  modal: ModalElement
}) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const {
    windowSize: { width: windowWidth, height: windowHeight },
  } = useWindow()
  const modalWidth = typeof modal.width === 'string' ? 400 : modal.width

  useEffectOnce(() => contentRef.current?.focus())

  const style: CSSProperties | undefined = useMemo(() => {
    const properties: CSSProperties = {
      width: modalWidth,
      maxHeight: windowHeight - (modal.position?.bottom || 0) - 10,
    }

    if (modal.position != null) {
      switch (modal.position.alignment) {
        case 'bottom-right':
          properties.left =
            modal.position.right < windowWidth - 10
              ? modal.position.right - modalWidth
              : windowWidth - modalWidth - 10
          properties.top = modal.position.bottom + 6
          break
        case 'bottom-left':
          properties.left =
            modal.position.left + modalWidth < windowWidth - 10
              ? modal.position.left
              : windowWidth - modalWidth - 10
          properties.top = modal.position.bottom + 6
          break
        default:
          break
      }
    }

    return properties
  }, [modal.position, windowWidth, modalWidth, windowHeight])

  return (
    <>
      <div className='modal__window__scroller'>
        <div className='modal__bg__hidden' onClick={closeModal}></div>
        <div className='modal__window__anchor' />
        <VerticalScroller
          className={cc([
            'modal__window',
            `modal__window__width--${modal.width}`,
            modal.position != null && `modal__window--context`,
          ])}
          style={style}
        >
          <div className='modal__wrapper' ref={contentRef} tabIndex={0}>
            {modal.title != null && (
              <h3 className='modal__title'>{modal.title}</h3>
            )}
            <div className='modal__content'>{modal.content}</div>
          </div>
        </VerticalScroller>
      </div>
    </>
  )
}

const ModalItem = ({
  closeModal,
  modal,
}: {
  closeModal: () => void
  modal: ModalElement
}) => {
  const contentRef = useRef<HTMLDivElement>(null)

  const onScrollClickHandler: React.MouseEventHandler = useCallback(
    (event) => {
      if (
        contentRef.current != null &&
        contentRef.current.contains(event.target as Node)
      ) {
        return
      }

      closeModal()
    },
    [closeModal]
  )

  return (
    <VerticalScroller
      className='modal__window__scroller'
      onClick={onScrollClickHandler}
    >
      <div
        ref={contentRef}
        className={cc([
          'modal__window',
          `modal__window__width--${modal.width}`,
          modal.position != null && `modal__window--context`,
        ])}
      >
        {modal.showCloseIcon && (
          <Button
            variant='icon'
            iconPath={mdiClose}
            onClick={closeModal}
            className='modal__window__close'
            iconSize={26}
          />
        )}
        <div className='modal__wrapper'>
          {modal.title != null && (
            <h3 className='modal__title'>{modal.title}</h3>
          )}
          <div className='modal__content'>{modal.content}</div>
        </div>
      </div>
    </VerticalScroller>
  )
}

export const zIndexModals = 8001
const Container = styled.div`
  z-index: ${zIndexModals};

  &:not(.modal--context)::before {
    content: '';
    z-index: ${zIndexModals + 1};
    position: fixed;
    height: 100vh;
    width: 100vw;
    top: 0;
    left: 0;
    background-color: #000;
    opacity: 0.7;
  }

  .modal__bg__hidden {
    z-index: ${zIndexModals + 1};
    position: fixed;
    height: 100vh;
    width: 100vw;
    top: 0;
    left: 0;
  }

  .modal__window__anchor {
    position: relative;
    z-index: ${zIndexModals + 3};
  }

  .modal__window__scroller {
    z-index: ${zIndexModals + 2};
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    overflow-x: hidden;
    overflow-y: auto;
    outline: 0;
  }

  .modal__window--context {
    border: 1px solid ${({ theme }) => theme.colors.border.main};
    margin: 0 !important;
    bottom: 0;
    right: 0;
    left: 0;
    background-color: ${({ theme }) =>
      theme.colors.background.primary} !important;
  }

  .modal__window {
    z-index: ${zIndexModals + 2};
    position: relative;
    width: 900px;
    max-width: 96%;
    background-color: ${({ theme }) => theme.colors.background.primary};
    box-shadow: ${({ theme }) => theme.colors.shadow};
    border-radius: 4px;
    height: fit-content;
    margin: 1.75rem auto;
    display: block;
    float: center;

    &.modal__window__width--fit {
      width: fit-content;
    }

    &.modal__window__width--small {
      width: 600px;
    }

    &.modal__window__width--large {
      width: 1100px;
    }
  }

  .modal__window__close {
    position: absolute;
    top: ${({ theme }) => theme.sizes.spaces.sm}px;
    right: ${({ theme }) => theme.sizes.spaces.df}px;
    white-space: nowrap;
    z-index: 1;
  }

  .modal__wrapper {
    display: flex;
    margin: 0;
    min-width: 0;
    width: 100%;
    flex-direction: column;
    align-items: stretch;
    padding: ${({ theme }) => theme.sizes.spaces.df}px
      ${({ theme }) => theme.sizes.spaces.md}px;
  }

  .modal__title {
    flex: 0 0 auto;
    margin: 0 0 ${({ theme }) => theme.sizes.spaces.md}px 0;
    font-size: ${({ theme }) => theme.sizes.fonts.xl}px;
  }

  .modal__content {
    flex: 1 1 10px;
  }
`
export default React.memo(Modal)
