import React, { useState, useMemo } from 'react'
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
function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: '1px solid var(--ev-c-gray-200)'
      }}
    >
      <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{label}</span>
      <span style={{ color: 'var(--color-text-soft)' }}>{value}</span>
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
          backgroundColor: 'var(--color-background-soft)',
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
            backgroundColor: 'var(--ev-c-gray-200)',
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
            color: 'var(--color-text)',
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
          <h4 style={{ marginTop: 0, marginBottom: '10px', color: 'var(--color-text)' }}>Tags</h4>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              marginBottom: '20px',
              minHeight: '40px',
              padding: '10px',
              background: 'var(--color-background-soft)',
              borderRadius: '6px',
              border: '1px solid var(--ev-c-gray-300)'
            }}
          >
            {tags.map((t, i) => (
              <span
                key={i}
                style={{
                  background: t.type === 'kv' ? 'var(--ev-c-blue-100)' : 'var(--ev-c-gray-200)',
                  color: t.type === 'kv' ? 'var(--ev-c-blue-800)' : 'var(--color-text)',
                  padding: '5px 12px',
                  borderRadius: '16px',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  height: 'fit-content'
                }}
              >
                {t.type === 'kv' ? (
                  <span>
                    <strong style={{ opacity: 0.75 }}>{t.key}:</strong> {t.value}
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
                    color: 'var(--color-text-mute)',
                    padding: '0 4px'
                  }}
                >
                  ×
                </button>
              </span>
            ))}
            {tags.length === 0 && (
              <span style={{ color: 'var(--color-text-mute)', fontStyle: 'italic' }}>Nessun tag</span>
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
                border: '1px solid var(--ev-c-gray-300)',
                fontSize: '0.95rem'
              }}
            />
            <button
              type="submit"
              style={{
                padding: '10px 20px',
                background: 'var(--color-primary)',
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
            borderTop: '1px solid var(--ev-c-gray-200)',
            paddingTop: '15px',
            marginTop: '25px'
          }}
        >
          <button
            onClick={() => window.api.openVideo(video.filePath)}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              color: 'var(--color-text)',
              border: '1px solid var(--ev-c-gray-300)',
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
                border: '1px solid var(--ev-c-gray-300)',
                borderRadius: '6px',
                cursor: 'pointer',
                color: 'var(--color-text-soft)'
              }}
            >
              Annulla
            </button>
            <button
              onClick={handleSaveClick}
              disabled={isSaving}
              style={{
                padding: '10px 20px',
                background: isSaving ? 'var(--ev-c-gray-400)' : 'var(--ev-c-blue-700)',
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
        border: '1px solid var(--ev-c-gray-300)',
        backgroundColor: 'var(--color-background-soft)',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.04)',
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow =
          '0 7px 14px rgba(0, 0, 0, 0.07), 0 3px 6px rgba(0, 0, 0, 0.07)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.04)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          width: '100%',
          height: '100px',
          backgroundColor: 'var(--ev-c-gray-200)',
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
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 0
        }}
      >
        {/* Category */}
        <div>
          {categoryTag && (
            <span style={{ color: 'var(--color-text-mute)', fontSize: '0.75rem', display: 'block', fontWeight: 500 }}>
              {categoryTag.key}: {categoryTag.value}
            </span>
          )}
          {secondaryTag && (
            <span style={{ color: 'var(--color-text-mute)', fontSize: '0.75rem', display: 'block', fontWeight: 500 }}>
              {secondaryTag.key}: {secondaryTag.value}
            </span>
          )}
        </div>

        {/* Title */}
        <h3
          style={{
            margin: 0,
            fontSize: '0.9rem',
            color: 'var(--color-text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.3
          }}
          title={video.fileName}
        >
          {video.fileName}
        </h3>
      </div>
    </div>
  )
}

type FilterCategory = 'category' | 'model' | 'channel' | 'production' | 'simpleTag'

type ActiveFilter = {
  category: FilterCategory
  value: string
}

// --- COMPONENTE: Sezione Filtri ---
function FilterSection({
  title,
  options,
  active,
  onSelect
}: {
  title: string
  options: string[]
  active?: string
  onSelect: (option: string | undefined) => void
}) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div style={{ marginBottom: '10px' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          textAlign: 'left',
          background: 'none',
          border: 'none',
          fontSize: '1rem',
          fontWeight: 600,
          padding: '10px 0',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span>{title}</span>
        <span>{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '5px' }}>
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => onSelect(active === opt ? undefined : opt)}
              style={{
                textAlign: 'left',
                background: active === opt ? 'var(--ev-c-blue-100)' : 'transparent',
                border: 'none',
                padding: '6px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                color: active === opt ? 'var(--ev-c-blue-700)' : 'var(--color-text)',
                fontWeight: active === opt ? 600 : 400
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// --- COMPONENTE: Sidebar ---
function Sidebar({
  filterOptions,
  activeFilters,
  onFilterChange,
  onClearFilters
}: {
  filterOptions: any
  activeFilters: ActiveFilter | null
  onFilterChange: (category: FilterCategory, value: string | undefined) => void
  onClearFilters: () => void
}) {
  return (
    <div
      style={{
        width: '240px',
        flexShrink: 0,
        borderRight: '1px solid var(--ev-c-gray-300)',
        padding: '20px',
        overflowY: 'auto',
        background: 'var(--color-background-soft)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Filters</h2>
        <button
          onClick={onClearFilters}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-mute)',
            cursor: 'pointer',
            fontSize: '0.8rem'
          }}
        >
          Clear
        </button>
      </div>

      <FilterSection
        title="Category"
        options={filterOptions.categories}
        active={activeFilters?.category === 'category' ? activeFilters.value : undefined}
        onSelect={(val) => onFilterChange('category', val)}
      />
      <FilterSection
        title="Model"
        options={filterOptions.models}
        active={activeFilters?.category === 'model' ? activeFilters.value : undefined}
        onSelect={(val) => onFilterChange('model', val)}
      />
      <FilterSection
        title="Channel"
        options={filterOptions.channels}
        active={activeFilters?.category === 'channel' ? activeFilters.value : undefined}
        onSelect={(val) => onFilterChange('channel', val)}
      />
      <FilterSection
        title="Production"
        options={filterOptions.productions}
        active={activeFilters?.category === 'production' ? activeFilters.value : undefined}
        onSelect={(val) => onFilterChange('production', val)}
      />
      <FilterSection
        title="Tags"
        options={filterOptions.simpleTags}
        active={activeFilters?.category === 'simpleTag' ? activeFilters.value : undefined}
        onSelect={(val) => onFilterChange('simpleTag', val)}
      />
    </div>
  )
}

// --- COMPONENTE PRINCIPALE APP ---
function App(): React.ReactElement {
  const [videos, setVideos] = useState<VideoFile[]>([])
  const [loading, setLoading] = useState(false)
  const [editingVideo, setEditingVideo] = useState<VideoFile | null>(null)
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  type ActiveFilter = {
  category: FilterCategory
  value: string
}

const [activeFilters, setActiveFilters] = useState<ActiveFilter | null>(null)

  // LOGICA DI CARICAMENTO/SCANSIONE
  const handleScan = async (): Promise<void> => {
    const folder = await window.api.selectFolder()
    if (folder) {
      setCurrentFolder(folder)
      setLoading(true)
      setVideos([])
      try {
        console.log(`Controllo library.json in: ${folder}`)
        const cachedVideos = await window.api.loadLibrary(folder)
        if (cachedVideos) {
          console.log('Trovato library.json! Caricamento immediato.')
          setVideos(cachedVideos)
        } else {
          console.log('Nessun library.json trovato. Avvio scansione completa...')
          const results = await window.api.scanVideos(folder)
          setVideos(results)
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
      await window.api.updateTags(editingVideo.filePath, newTags)
      const updatedList = videos.map((v) =>
        v.id === editingVideo.id ? { ...v, tags: newTags } : v
      )
      setVideos(updatedList)
      await window.api.saveLibrary(currentFolder, updatedList)
    } catch (error) {
      console.error(error)
      alert('Errore impossibile salvare i tag.')
    }
  }

  const filterOptions = useMemo(() => {
    const categories = new Set<string>()
    const models = new Set<string>()
    const channels = new Set<string>()
    const productions = new Set<string>()
    const simpleTags = new Set<string>()

    videos.forEach((video) => {
      video.tags.forEach((tag) => {
        if (tag.type === 'kv') {
          if (tag.key === 'category') categories.add(tag.value)
          if (tag.key === 'model') models.add(tag.value)
          if (tag.key === 'channel') channels.add(tag.value)
          if (tag.key === 'production') productions.add(tag.value)
        } else {
          simpleTags.add(tag.value)
        }
      })
    })

    return {
      categories: [...categories].sort(),
      models: [...models].sort(),
      channels: [...channels].sort(),
      productions: [...productions].sort(),
      simpleTags: [...simpleTags].sort()
    }
  }, [videos])

  const handleFilterChange = (category: FilterCategory, value: string | undefined) => {
    setActiveFilters(() => {
      if (!value) {
        // If the value is undefined, it means we are clearing the filter
        return null
      }

      // If a new filter is selected, make it the only active filter
      return { category, value }
    })
  }

  const handleClearFilters = () => {
    setActiveFilters(null)
  }

  const filteredVideos = useMemo(() => {
    if (!activeFilters) {
      return videos
    }

    return videos.filter((video) => {
      const { category, value } = activeFilters

      if (category === 'simpleTag') {
        return video.tags.some((t) => t.type === 'simple' && t.value === value)
      } else {
        return video.tags.some((t) => t.type === 'kv' && t.key === category && t.value === value)
      }
    })
  }, [videos, activeFilters])

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden',
        backgroundColor: 'var(--color-background)'
      }}
    >
      <header
        style={{
          padding: '15px 25px',
          backgroundColor: 'var(--color-background-soft)',
          borderBottom: '1px solid var(--ev-c-gray-300)',
          zIndex: 10,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <h1 style={{ color: 'var(--color-text)', margin: 0, fontSize: '1.2rem' }}>Video Catalog</h1>

        <button
          onClick={handleScan}
          disabled={loading}
          style={{
            padding: '10px 20px',
            fontSize: '1rem',
            backgroundColor: loading ? 'var(--ev-c-gray-400)' : 'var(--color-primary)',
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

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          filterOptions={filterOptions}
          activeFilters={activeFilters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />

        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px'
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '20px'
            }}
          >
            {filteredVideos.map((vid) => (
              <VideoCard key={vid.id} video={vid} onEdit={() => setEditingVideo(vid)} />
            ))}

            {!loading && videos.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--color-text-mute)', marginTop: '40px' }}>
                Nessun video caricato. Clicca il pulsante blu per iniziare.
              </div>
            )}
            {!loading && videos.length > 0 && filteredVideos.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--color-text-mute)', marginTop: '40px' }}>
                Nessun video corrisponde ai filtri selezionati.
              </div>
            )}
          </div>
        </main>
      </div>

      {editingVideo && (
        <EditModal video={editingVideo} onClose={() => setEditingVideo(null)} onSave={saveTags} />
      )}
    </div>
  )
}

export default App


