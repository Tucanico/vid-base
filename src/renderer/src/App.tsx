import React, { useState } from 'react'
// Assicurati che questi percorsi corrispondano alla tua struttura
import { ParsedTag } from 'src/shared/types/metadata'
import { VideoFile } from 'src/shared/types/video'

// Dichiariamo i tipi per window.api (esposti dal preload)
declare global {
  interface Window {
    api: {
      selectFolder: () => Promise<string | null>
      scanVideos: (path: string) => Promise<VideoFile[]>
      openVideo: (path: string) => void
      updateTags: (filePath: string, tags: ParsedTag[]) => Promise<void>
      // API per la gestione del database JSON locale
      loadLibrary: (folderPath: string) => Promise<VideoFile[] | null>
      saveLibrary: (folderPath: string, videos: VideoFile[]) => Promise<void>
    }
  }
}

// --- COMPONENTE: MODALE DI EDITING ---
// --- COMPONENTE: MODALE DI EDITING ---

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '6px 0',
        borderBottom: '1px solid #f3f4f6'
      }}
    >
      <span style={{ fontWeight: 500, color: '#374151' }}>{label}</span>
      <span style={{ color: '#1f2937' }}>{value}</span>
    </div>
  )
}

function EditModal({
  video,
  onClose,
  onSave
}: {
  video: VideoFile
  onClose: () => void
  onSave: (tags: ParsedTag[]) => void
}): React.ReactElement {
  const [tags, setTags] = useState<ParsedTag[]>(video.tags)
  const [inputValue, setInputValue] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleAddTag = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!inputValue.trim()) return

    // Parsing tag: riconosce automaticamente "chiave:valore"
    let newTag: ParsedTag
    if (inputValue.includes(':')) {
      const [key, ...val] = inputValue.split(':')
      newTag = {
        type: 'kv',
        key: key.trim().toLowerCase(),
        value: val.join(':').trim(),
        original: inputValue
      }
    } else {
      newTag = { type: 'simple', value: inputValue.trim(), original: inputValue }
    }

    setTags([...tags, newTag])
    setInputValue('')
  }

  const removeTag = (index: number): void => {
    setTags(tags.filter((_, i) => i !== index))
  }

  const handleSaveClick = async (): Promise<void> => {
    setIsSaving(true)
    await onSave(tags)
    setIsSaving(false)
    onClose()
  }

  const categoryTag = tags.find((t) => t.type === 'kv' && t.key === 'category')
  const modelTag = tags.find((t) => t.type === 'kv' && t.key === 'model')
  const channelTag = tags.find((t) => t.type === 'kv' && t.key === 'channel')
  const productionTag = tags.find((t) => t.type === 'kv' && t.key === 'production')

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '25px',
          borderRadius: '12px',
          width: '600px',
          maxWidth: '95%',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
        }}
      >
        {/* Thumbnail */}
        <div
          style={{
            width: '100%',
            height: '250px',
            backgroundColor: '#f3f4f6',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '15px'
          }}
        >
          {video.thumbnailPath ? (
            <img
              src={`media:///${video.thumbnailPath.replace(/\\/g, '/')}`}
              alt="thumbnail"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <span style={{ fontSize: '3rem' }}>🎬</span>
            </div>
          )}
        </div>

        {/* Title */}
        <h2
          style={{
            marginTop: 0,
            color: '#1f2937',
            fontSize: '1.4rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: '20px',
            textAlign: 'center'
          }}
          title={video.fileName}
        >
          {video.fileName}
        </h2>

        {/* Info Section */}
        <div style={{ marginBottom: '25px' }}>
          <InfoRow label="Category" value={categoryTag?.value} />
          <InfoRow label="Model" value={modelTag?.value} />
          <InfoRow label="Channel" value={channelTag?.value} />
          <InfoRow label="Production" value={productionTag?.value} />
        </div>

        {/* Tag Editor */}
        <div>
          <h4 style={{ marginTop: 0, marginBottom: '10px', color: '#4b5563' }}>Tags</h4>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              marginBottom: '20px',
              minHeight: '40px',
              padding: '10px',
              background: '#f9fafb',
              borderRadius: '6px',
              border: '1px solid #e5e7eb'
            }}
          >
            {tags.map((t, i) => (
              <span
                key={i}
                style={{
                  background: t.type === 'kv' ? '#e0f2fe' : '#e5e7eb',
                  color: t.type === 'kv' ? '#0369a1' : '#374151',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  border: '1px solid rgba(0,0,0,0.05)',
                  height: 'fit-content'
                }}
              >
                {t.type === 'kv' ? (
                  <span>
                    <strong>{t.key}:</strong> {t.value}
                  </span>
                ) : (
                  t.value
                )}
                <button
                  onClick={() => removeTag(i)}
                  style={{
                    marginLeft: '8px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    color: '#ef4444',
                    padding: '0 4px'
                  }}
                >
                  ×
                </button>
              </span>
            ))}
            {tags.length === 0 && (
              <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Nessun tag</span>
            )}
          </div>
          <form onSubmit={handleAddTag} style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Es: vacanze o categoria:natura"
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '0.95rem'
              }}
            />
            <button
              type="submit"
              style={{
                padding: '10px 20px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Aggiungi
            </button>
          </form>
        </div>

        {/* Bottoni Azione */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            borderTop: '1px solid #f3f4f6',
            paddingTop: '15px',
            marginTop: '25px'
          }}
        >
          <button
            onClick={() => window.api.openVideo(video.filePath)}
            style={{
              padding: '10px 20px',
              background: '#ecfdf5',
              color: '#059669',
              border: '1px solid #a7f3d0',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            ▶ Play
          </button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              disabled={isSaving}
              style={{
                padding: '10px 20px',
                background: 'transparent',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                color: '#4b5563'
              }}
            >
              Annulla
            </button>
            <button
              onClick={handleSaveClick}
              disabled={isSaving}
              style={{
                padding: '10px 20px',
                background: '#059669',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              {isSaving ? 'Salvataggio...' : 'Salva Modifiche'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- COMPONENTE: Video Card ---
function VideoCard({
  video,
  onEdit
}: {
  video: VideoFile
  onEdit: () => void
}): React.ReactElement {
  const categoryTag = video.tags.find((t) => t.type === 'kv' && t.key === 'category')
  const channelTag = video.tags.find((t) => t.type === 'kv' && t.key === 'channel')
  const modelTag = video.tags.find((t) => t.type === 'kv' && t.key === 'model')
  const secondaryTag = channelTag || modelTag

  return (
    <div
      onClick={onEdit}
      style={{
        width: '200px',
        height: '180px',
        border: '1px solid #e5e7eb',
        backgroundColor: '#fff',
        borderRadius: '8px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        cursor: 'pointer',
        transition: 'transform 0.1s, box-shadow 0.1s',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          width: '100%',
          height: '100px',
          backgroundColor: '#f3f4f6',
          overflow: 'hidden'
        }}
      >
        {video.thumbnailPath ? (
          <img
            src={`media:///${video.thumbnailPath.replace(/\\/g, '/')}`}
            alt="thumbnail"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
            onError={(e) => {
              console.error('Errore caricamento:', video.thumbnailPath)
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            <span style={{ fontSize: '2.5rem' }}>🎬</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 0
        }}
      >
        {/* Category */}
        <div>
          {categoryTag && (
            <span style={{ color: '#6b7280', fontSize: '0.7rem', display: 'block' }}>
              {categoryTag.key}: {categoryTag.value}
            </span>
          )}
          {secondaryTag && (
            <span style={{ color: '#6b7280', fontSize: '0.7rem', display: 'block' }}>
              {secondaryTag.key}: {secondaryTag.value}
            </span>
          )}
        </div>

        {/* Title */}
        <h3
          style={{
            margin: 0,
            fontSize: '1rem',
            color: '#1f2937',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
          title={video.fileName}
        >
          {video.fileName}
        </h3>
      </div>
    </div>
  )
}

// --- COMPONENTE PRINCIPALE APP ---
function App(): React.ReactElement {
  const [videos, setVideos] = useState<VideoFile[]>([])
  const [loading, setLoading] = useState(false)
  const [editingVideo, setEditingVideo] = useState<VideoFile | null>(null)

  // Stato fondamentale per sapere dove salvare il JSON
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)

  // LOGICA DI CARICAMENTO/SCANSIONE
  const handleScan = async (): Promise<void> => {
    const folder = await window.api.selectFolder()
    if (folder) {
      setCurrentFolder(folder)
      setLoading(true)
      setVideos([])
      try {
        console.log(`Controllo library.json in: ${folder}`)

        // 1. Prima controlliamo se esiste già il JSON (Cache)
        const cachedVideos = await window.api.loadLibrary(folder)

        if (cachedVideos) {
          console.log('Trovato library.json! Caricamento immediato.')
          setVideos(cachedVideos)
        } else {
          console.log('Nessun library.json trovato. Avvio scansione completa...')
          // 2. Se non esiste, scansione fisica dei file + generazione miniature
          const results = await window.api.scanVideos(folder)
          setVideos(results)
          // 3. Salvataggio del risultato nel JSON per il futuro
          await window.api.saveLibrary(folder, results)
        }
      } catch (error) {
        console.error('Errore caricamento:', error)
        alert("C'è stato un errore durante il caricamento.")
      } finally {
        setLoading(false)
      }
    }
  }

  // LOGICA SALVATAGGIO TAG
  const saveTags = async (newTags: ParsedTag[]): Promise<void> => {
    if (!editingVideo || !currentFolder) return

    try {
      // 1. Scrivi Metadata nel file video fisico (ExifTool)
      await window.api.updateTags(editingVideo.filePath, newTags)

      // 2. Aggiorna lo stato React
      const updatedList = videos.map((v) =>
        v.id === editingVideo.id ? { ...v, tags: newTags } : v
      )
      setVideos(updatedList)

      // 3. Aggiorna il JSON library.json nella cartella (Sincronizzazione)
      await window.api.saveLibrary(currentFolder, updatedList)
    } catch (error) {
      console.error(error)
      alert('Errore impossibile salvare i tag.')
    }
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden', // Blocca scroll esterno
        backgroundColor: '#f9fafb'
      }}
    >
      {/* HEADER FISSO */}
      <header
        style={{
          padding: '20px',
          textAlign: 'center',
          backgroundColor: '#fff',
          borderBottom: '1px solid #e5e7eb',
          zIndex: 10,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          flexShrink: 0
        }}
      >
        <h1 style={{ color: '#111827', margin: '0 0 10px 0' }}>Video Catalog</h1>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
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
          {loading ? 'Sto caricando...' : '📂 Seleziona Cartella Video'}
        </button>
      </header>

      {/* AREA CONTENUTO SCROLLABILE */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          backgroundColor: '#f9fafb'
        }}
      >
        <div
          style={{
            padding: '20px',
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '20px'
          }}
        >
          {videos.map((vid) => (
            <VideoCard key={vid.id} video={vid} onEdit={() => setEditingVideo(vid)} />
          ))}

          {!loading && videos.length === 0 && (
            <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '40px' }}>
              Nessun video caricato. Clicca il pulsante blu per iniziare.
            </div>
          )}
        </div>
      </div>

      {/* MODALE DI EDITING (Appare solo se editingVideo è settato) */}
      {editingVideo && (
        <EditModal video={editingVideo} onClose={() => setEditingVideo(null)} onSave={saveTags} />
      )}
    </div>
  )
}

export default App

