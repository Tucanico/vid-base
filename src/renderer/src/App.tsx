import React, { useState } from 'react'
// Assicurati che questo percorso punti correttamente al tuo file types.ts
import { VideoFile, ParsedTag } from '../../shared/types'

// Dichiariamo i tipi per window.api (esposti dal preload)
declare global {
  interface Window {
    api: {
      selectFolder: () => Promise<string | null>
      scanVideos: (path: string) => Promise<VideoFile[]>
      openVideo: (path: string) => void
    }
  }
}

// Componente per visualizzare i singoli tag colorati
function TagBadge({ tag }: { tag: ParsedTag }) {
  // Stile speciale per i tag Chiave-Valore (es: categoria:vintage)
  if (tag.type === 'kv') {
    return (
      <span
        style={{
          backgroundColor: '#e0f2fe', // Azzurro chiaro
          color: '#0369a1', // Blu scuro
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '0.75rem',
          fontWeight: 600,
          marginRight: '6px',
          border: '1px solid #bae6fd',
          display: 'inline-flex',
          alignItems: 'center'
        }}
      >
        <span style={{ opacity: 0.7, marginRight: '3px', fontWeight: 400 }}>{tag.key}:</span>
        {tag.value}
      </span>
    )
  }

  // Stile per i tag semplici (es: vacanze)
  return (
    <span
      style={{
        backgroundColor: '#f3f4f6', // Grigio
        color: '#374151',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '0.75rem',
        marginRight: '6px',
        border: '1px solid #e5e7eb'
      }}
    >
      {tag.value}
    </span>
  )
}

function App(): JSX.Element {
  const [videos, setVideos] = useState<VideoFile[]>([])
  const [loading, setLoading] = useState(false)

  const handleScan = async () => {
    // 1. Chiede al backend di aprire il selettore cartella
    const folder = await window.api.selectFolder()

    if (folder) {
      setLoading(true)
      setVideos([]) // Pulisce la lista precedente
      try {
        // 2. Chiede al backend di scansionare quella cartella
        const results = await window.api.scanVideos(folder)
        setVideos(results)
      } catch (error) {
        console.error('Errore durante la scansione:', error)
        alert("C'è stato un errore durante la lettura dei file.")
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div
      style={{
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        maxWidth: '800px',
        margin: '0 auto'
      }}
    >
      <header style={{ marginBottom: '30px', textAlign: 'center' }}>
        <h1 style={{ color: '#111827', marginBottom: '10px' }}>Video Catalog</h1>
        <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
          Organizza i tuoi file video con i metadati di Windows
        </p>

        <button
          onClick={handleScan}
          disabled={loading}
          style={{
            marginTop: '15px',
            padding: '10px 20px',
            fontSize: '1rem',
            backgroundColor: loading ? '#9ca3af' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s'
          }}
        >
          {loading ? 'Sto scansionando i file...' : '📂 Seleziona Cartella Video'}
        </button>
      </header>

      {/* Lista dei Video */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {videos.map((vid) => (
          <div
            key={vid.id}
            style={{
              border: '1px solid #e5e7eb',
              backgroundColor: '#fff',
              padding: '16px',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ flex: 1, marginRight: '20px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#1f2937' }}>
                {vid.fileName}
              </h3>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {vid.tags && vid.tags.length > 0 ? (
                  vid.tags.map((t, i) => <TagBadge key={i} tag={t} />)
                ) : (
                  <span style={{ color: '#9ca3af', fontSize: '0.8rem', fontStyle: 'italic' }}>
                    Nessun tag (Aggiungi tags in Windows Explorer)
                  </span>
                )}
              </div>

              {/* Debug: mostra il path completo al passaggio del mouse */}
              <div
                style={{ marginTop: '5px', fontSize: '0.7rem', color: '#d1d5db' }}
                title={vid.filePath}
              >
                {vid.filePath}
              </div>
            </div>

            <button
              onClick={() => window.api.openVideo(vid.filePath)}
              style={{
                cursor: 'pointer',
                padding: '8px 16px',
                backgroundColor: '#ecfdf5',
                color: '#059669',
                border: '1px solid #a7f3d0',
                borderRadius: '6px',
                fontWeight: 600
              }}
            >
              ▶ Play
            </button>
          </div>
        ))}

        {/* Messaggio se non ci sono video */}
        {!loading && videos.length === 0 && (
          <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '40px' }}>
            Nessun video caricato. Clicca il pulsante blu per iniziare.
          </div>
        )}
      </div>
    </div>
  )
}

export default App
