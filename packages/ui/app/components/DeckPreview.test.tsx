import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DeckPreview } from './DeckPreview'

describe('DeckPreview', () => {
  it('shows empty state when content is empty string', () => {
    render(<DeckPreview content="" />)
    expect(screen.getByText(/No deck generated yet/i)).toBeInTheDocument()
    expect(screen.getByText('Generate All')).toBeInTheDocument()
  })

  it('renders iframe with the blob URL when content is provided', () => {
    render(<DeckPreview content="<html><body>Slide content</body></html>" />)

    const iframe = screen.getByTitle('Presentation deck')
    expect(iframe).toBeInTheDocument()
    expect(iframe).toHaveAttribute('src', 'blob:mock-url')
  })

  it('iframe has sandbox attribute for security', () => {
    render(<DeckPreview content="<html>x</html>" />)
    const iframe = screen.getByTitle('Presentation deck')
    expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin')
  })

  it('renders a download link for the deck', () => {
    render(<DeckPreview content="<html>x</html>" />)
    const link = screen.getByRole('link', { name: /Download deck\.html/i })
    expect(link).toHaveAttribute('download', 'deck.html')
  })

  it('does not show empty-state message when content is provided', () => {
    render(<DeckPreview content="<html>x</html>" />)
    expect(screen.queryByText(/No deck generated yet/i)).not.toBeInTheDocument()
  })
})
