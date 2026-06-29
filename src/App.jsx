// React hooks used in this file:
// - useState stores UI data that can change.
// - useEffect runs side effects like initial API loading.
// - useMemo recalculates derived data only when inputs change.
// - useRef points at DOM elements for menus/dropdowns.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  BookOpen,
  Bookmark,
  Check,
  ChevronDown,
  FolderOpen,
  Github,
  Home,
  Library,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  Upload,
  X
} from "lucide-react";
// catalogApi is the only object in this file that talks to the backend.
// Components call catalogApi methods; api.js turns those calls into fetch() requests.
import { catalogApi } from "./api";

// Blank form shape for adding/editing comics. It matches the JSON fields the backend expects.
const emptyComic = {
  comicTitle: "",
  comicIssue: "",
  comicStartYear: "",
  comicDesc: ""
};

// Blank rating form shape. ratingScore starts at 0 so the UI can require a 1-10 choice.
const emptyRating = {
  ratingScore: 0,
  ratingReview: ""
};

// Dropdown choices for sorting the library. The selected value controls sortedCatalog in LibraryView.
const sortOptions = [
  { value: "year-desc", label: "Year ↓" },
  { value: "year-asc", label: "Year ↑" },
  { value: "title-asc", label: "A-Z" },
  { value: "title-desc", label: "Z-A" },
  { value: "rating-desc", label: "Rating ↓" },
  { value: "rating-asc", label: "Rating ↑" }
];

const supportedCoverImageTypes = ["image/jpeg", "image/png"];
function isSupportedCoverImage(file) {
  return supportedCoverImageTypes.includes(file?.type);
}

// App is the top-level coordinator. It owns the data loaded from the backend,
// decides which page/view is visible, and passes event handlers down to child
// components. Child components do the UI work; App refreshes shared data after
// create/update/delete actions.
export default function App() {
  // ----- Global app state -----
  // view chooses the current screen. The catalog/collections/wanted arrays are
  // the latest backend data used by multiple screens.
  const [view, setView] = useState("library");
  const [catalog, setCatalog] = useState([]);
  const [collections, setCollections] = useState([]);
  const [wantedCatalog, setWantedCatalog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [wantedLoading, setWantedLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ratingModalItem, setRatingModalItem] = useState(null);
  const [wantedModalItem, setWantedModalItem] = useState(null);
  const [prefilledComicId, setPrefilledComicId] = useState("");
  const [editingComic, setEditingComic] = useState(null);
  const [editingWantedComic, setEditingWantedComic] = useState(null);
  const [imageVersion, setImageVersion] = useState(Date.now());

  // Loads the normal library from GET /catalog.
  // When the response returns, setCatalog(...) stores it in React state, which
  // causes the library UI to re-render with fresh cards.
  async function loadCatalog() {
    setLoading(true);
    setError("");

    try {
      const data = await catalogApi.getCatalog();
      setCatalog(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setLoading(false);
    }
  }

  // Loads collection folders from GET /catalog/collections.
  // Collection load failures are non-fatal because the library can still work.
  async function loadCollections() {
    setCollectionsLoading(true);
    setError("");

    try {
      const data = await catalogApi.getCollections();
      setCollections(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Collections failed to load", err);
      setCollections([]);
    } finally {
      setCollectionsLoading(false);
    }
  }

  // Loads wanted comics from GET /catalog/wanted.
  async function loadWantedCatalog() {
    setWantedLoading(true);
    setError("");

    try {
      const data = await catalogApi.getWantedCatalog();
      setWantedCatalog(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setWantedLoading(false);
    }
  }

  // Refreshes every data source in parallel. Use this after a successful write
  // so the UI reflects backend state instead of guessing locally.
  async function refreshAppData() {
    await Promise.all([loadCatalog(), loadCollections(), loadWantedCatalog()]);
  }

  // Collection write handlers are kept in App because both the Collections page
  // and the dashboard count need the updated collection data after each write.
  async function createCollection(collection) {
    const created = await catalogApi.addCollection(collection);
    setNotice(`${created.collectionName} was created.`);
    await refreshAppData();
    return created;
  }

  async function deleteCollection(collection) {
    await catalogApi.deleteCollection(collection.collectionId);
    setNotice(`${collection.collectionName} was deleted.`);
    await refreshAppData();
  }

  async function addComicToCollection(collectionId, comicId) {
    await catalogApi.addComicToCollection(collectionId, comicId);
    const collection = collections.find((item) => item.collectionId === collectionId);
    setNotice(`Book added to ${collection?.collectionName || "collection"}.`);
    await refreshAppData();
  }

  async function removeComicFromCollection(collectionId, comicId) {
    await catalogApi.removeComicFromCollection(collectionId, comicId);
    setNotice("Book removed from collection.");
    await refreshAppData();
  }

  // Initial page load. The empty dependency array means this runs once when the
  // React app first mounts in the browser.
  useEffect(() => {
    refreshAppData();
  }, []);

  // Navigation helpers reset temporary form/modal state and then refresh data.
  function goToLibrary(message = "") {
    setView("library");
    setPrefilledComicId("");
    setEditingComic(null);
    setEditingWantedComic(null);
    setWantedModalItem(null);
    setNotice(message);
    setImageVersion(Date.now());
    refreshAppData();
  }

  function goToWanted(message = "") {
    setView("wanted");
    setEditingComic(null);
    setEditingWantedComic(null);
    setWantedModalItem(null);
    setNotice(message);
    setImageVersion(Date.now());
    refreshAppData();
  }

  function goToAddRating(comicId = "") {
    setPrefilledComicId(comicId);
    setView("addRating");
    setNotice("");
  }

  function pageTitle() {
    if (view === "collections") return "Your Collections";
    if (["wanted", "addWanted", "editWanted"].includes(view)) return "Wanted Comics";
    return "Your Library";
  }

  // Render chooses one main view based on `view`. Notice that most child
  // components receive callbacks like onCreated/onDelete instead of directly
  // mutating App state themselves.
  return (
    <div className="app-shell">
      <Sidebar
        activeView={view}
        onNavigate={(nextView) => {
          setView(nextView);
          setEditingComic(null);
          setEditingWantedComic(null);
          setWantedModalItem(null);
          setNotice("");
        }}
      />

      <main className="main-panel">
        <header className="topbar">
          <div>
            <h1>{pageTitle()}</h1>
          </div>
          <button className="icon-button" onClick={refreshAppData} title="Refresh catalog">
            <RefreshCw size={20} />
          </button>
        </header>

        {notice && (
          <div className="notice">
            <Check size={18} />
            <span>{notice}</span>
            <button onClick={() => setNotice("")} title="Dismiss">
              <X size={16} />
            </button>
          </div>
        )}

        {error && (
          <div className="error-banner">
            <AlertTriangle size={18} />
            <span>{error}</span>
            <button onClick={() => setError("")} title="Dismiss">
              <X size={16} />
            </button>
          </div>
        )}

        {view === "library" && (
          <LibraryView
            catalog={catalog}
            collectionsCount={collections.length}
            wantedCount={wantedCatalog.length}
            loading={loading}
            onAddComic={() => setView("addComic")}
            onAddRating={goToAddRating}
            onManageRating={setRatingModalItem}
            onEditComic={(item) => {
              setEditingComic(item);
              setView("editComic");
              setNotice("");
            }}
            onDeleteComic={async (item) => {
              await catalogApi.deleteComic(item.comicId);
              goToLibrary(`${item.comicTitle} was deleted.`);
            }}
            imageVersion={imageVersion}
          />
        )}

        {view === "collections" && (
          <CollectionsView
            collections={collections}
            catalog={catalog}
            loading={collectionsLoading}
            imageVersion={imageVersion}
            onCreateCollection={createCollection}
            onDeleteCollection={deleteCollection}
            onAddComicToCollection={addComicToCollection}
            onRemoveComicFromCollection={removeComicFromCollection}
          />
        )}

        {view === "wanted" && (
          <WantedView
            wantedCatalog={wantedCatalog}
            loading={wantedLoading}
            imageVersion={imageVersion}
            onAddWanted={() => setView("addWanted")}
            onOpenWanted={setWantedModalItem}
          />
        )}

        {view === "addComic" && (
          <AddComicView
            onCancel={() => goToLibrary()}
            onCreated={(comic) => {
              setPrefilledComicId(comic.comicId);
              setNotice(`${comic.comicTitle} was added.`);
              setImageVersion(Date.now());
              refreshAppData();
            }}
            onRateNewComic={(comicId) => goToAddRating(comicId)}
          />
        )}

        {view === "addWanted" && (
          <AddWantedView
            onCancel={() => goToWanted()}
            onCreated={(comic) => {
              setNotice(`${comic.comicTitle} was added to Wanted.`);
              setImageVersion(Date.now());
              refreshAppData();
            }}
          />
        )}

        {view === "editComic" && editingComic && (
          <EditComicView
            item={editingComic}
            imageVersion={imageVersion}
            onCancel={() => goToLibrary()}
            onSaved={(comic) => goToLibrary(`${comic.comicTitle} was updated.`)}
          />
        )}

        {view === "editWanted" && editingWantedComic && (
          <EditComicView
            item={editingWantedComic}
            imageVersion={imageVersion}
            onCancel={() => goToWanted()}
            onSaved={(comic) => goToWanted(`${comic.comicTitle} was updated.`)}
          />
        )}

        {view === "addRating" && (
          <AddRatingView
            catalog={catalog}
            prefilledComicId={prefilledComicId}
            onCancel={() => goToLibrary()}
            onCreated={(rating) => goToLibrary(`Rating saved at ${rating.ratingScore}/10.`)}
            onManageExisting={setRatingModalItem}
          />
        )}
      </main>

      {wantedModalItem && (
        <WantedComicModal
          item={wantedModalItem}
          imageVersion={imageVersion}
          onClose={() => setWantedModalItem(null)}
          onEdit={(item) => {
            setWantedModalItem(null);
            setEditingWantedComic(item);
            setView("editWanted");
            setNotice("");
          }}
          onMoveToLibrary={async (item) => {
            await catalogApi.moveWantedComicToLibrary(item.comicId);
            setWantedModalItem(null);
            goToLibrary(`${item.comicTitle} moved to your library.`);
          }}
          onDelete={async (item) => {
            await catalogApi.deleteComic(item.comicId);
            setWantedModalItem(null);
            goToWanted(`${item.comicTitle} was removed from Wanted.`);
          }}
        />
      )}

      {ratingModalItem && (
        <RatingModal
          item={ratingModalItem}
          onClose={() => setRatingModalItem(null)}
          onSaved={(message) => {
            setRatingModalItem(null);
            goToLibrary(message);
          }}
        />
      )}
    </div>
  );
}

// Sidebar is pure navigation. It does not fetch data; it only asks App to
// switch `view`.
function Sidebar({ activeView, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <BookOpen size={28} />
        <div>
          <strong>Comic Catalog</strong>
          <span>Track all your books!</span>
        </div>
      </div>

      <nav className="nav-list">
        <button className={activeView === "library" ? "active" : ""} onClick={() => onNavigate("library")}>
          <Home size={18} />
          Library
        </button>
        <button className={activeView === "addComic" ? "active" : ""} onClick={() => onNavigate("addComic")}>
          <Plus size={18} />
          Add Book
        </button>
        <button className={activeView === "addRating" ? "active" : ""} onClick={() => onNavigate("addRating")}>
          <Star size={18} />
          Add Rating
        </button>
        <button className={activeView === "collections" ? "active" : ""} onClick={() => onNavigate("collections")}>
          <FolderOpen size={18} />
          Collections
        </button>
        <button className={activeView === "wanted" ? "active" : ""} onClick={() => onNavigate("wanted")}>
          <Bookmark size={18} />
          Wanted
        </button>
      </nav>

      <a className="github-link" href="https://github.com/HasNas03/" target="_blank" rel="noreferrer">
        <Github size={18} />
        GitHub
      </a>
    </aside>
  );
}

// LibraryView displays the combined catalog returned by the backend. Each item
// already contains comic info plus rating fields, so this component can render
// cards without calling rating/info services itself.
function LibraryView({ catalog, collectionsCount, wantedCount, loading, onAddComic, onAddRating, onManageRating, onEditComic, onDeleteComic, imageVersion }) {
  const [sortMode, setSortMode] = useState("year-desc");
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef(null);
  const selectedSort = sortOptions.find((option) => option.value === sortMode) || sortOptions[0];
  const ratedCount = catalog.filter((item) => item.ratingScore != null).length;
  const average = ratedCount
    ? (catalog.reduce((sum, item) => sum + (item.ratingScore || 0), 0) / ratedCount).toFixed(1)
    : "0.0";

  useCloseOnOutsideClick(sortRef, sortOpen, setSortOpen);

  // Derived UI data: sorting does not change backend data, it only changes the
  // order shown on this page.
  const sortedCatalog = useMemo(() => {
    return [...catalog].sort((first, second) => {
      if (sortMode === "title-asc") return (first.comicTitle || "").localeCompare(second.comicTitle || "", undefined, { sensitivity: "base" });
      if (sortMode === "title-desc") return (second.comicTitle || "").localeCompare(first.comicTitle || "", undefined, { sensitivity: "base" });
      if (sortMode === "rating-asc") return (first.ratingScore ?? 11) - (second.ratingScore ?? 11);
      if (sortMode === "rating-desc") return (second.ratingScore ?? -1) - (first.ratingScore ?? -1);
      if (sortMode === "year-asc") return (Number(first.comicStartYear) || 0) - (Number(second.comicStartYear) || 0);
      return (Number(second.comicStartYear) || 0) - (Number(first.comicStartYear) || 0);
    });
  }, [catalog, sortMode]);

  if (loading) return <EmptyState title="Loading library" text="Fetching your catalog." />;

  return (
    <section className="content-stack">
      <div className="summary-grid">
        <SummaryTile label="Books" value={catalog.length} variant="comics" icon={<BookOpen size={26} />} />
        <SummaryTile label="Rated" value={ratedCount} variant="rated" icon={<Star size={26} />} />
        <SummaryTile label="Average Rating" value={average} variant="average" icon={<Check size={26} />} />
        <SummaryTile label="Collections" value={collectionsCount} variant="collections" icon={<FolderOpen size={26} />} />
        <SummaryTile label="Wanted" value={wantedCount} variant="wanted" icon={<Bookmark size={26} />} />
      </div>

      {catalog.length > 0 && (
        <div className="library-controls">
          <div className="sort-control" ref={sortRef}>
            <button type="button" className="sort-trigger" onClick={() => setSortOpen((current) => !current)} aria-haspopup="listbox" aria-expanded={sortOpen}>
              <ArrowUpDown size={16} />
              <span>{selectedSort.label}</span>
              <ChevronDown size={16} />
            </button>

            {sortOpen && (
              <div className="sort-menu" role="listbox" aria-label="Sort library">
                {sortOptions.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    className={option.value === sortMode ? "selected" : ""}
                    onClick={() => {
                      setSortMode(option.value);
                      setSortOpen(false);
                    }}
                    role="option"
                    aria-selected={option.value === sortMode}
                  >
                    <Check size={16} />
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {catalog.length === 0 ? (
        <EmptyState title="No books yet" text="Add your first book to start building your collection." actionLabel="Add Book" onAction={onAddComic} />
      ) : (
        <div className="catalog-list">
          {sortedCatalog.map((item) => (
            <CatalogCard
              key={item.comicId}
              item={item}
              onDeleteComic={onDeleteComic}
              onManageRating={onManageRating}
              onEditComic={onEditComic}
              onAddRating={onAddRating}
              imageVersion={imageVersion}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SummaryTile({ label, value, variant, icon }) {
  return (
    <div className={`summary-tile ${variant || ""}`}>
      <div className="summary-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

// CollectionsView owns temporary collection-page form state. Actual saving is
// delegated back to App through callbacks so App can refresh shared data.
function CollectionsView({ collections, catalog, loading, imageVersion, onCreateCollection, onDeleteCollection, onAddComicToCollection, onRemoveComicFromCollection }) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ collectionName: "" });
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [selectedComicId, setSelectedComicId] = useState("");
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState("");
  const [confirmDeleteCollection, setConfirmDeleteCollection] = useState(null);
  const selectedCollection = collections.find((collection) => collection.collectionId === selectedCollectionId) || null;
  const selectedComicIds = new Set((selectedCollection?.comics || []).map((comic) => comic.comicId));
  const availableComics = catalog.filter((comic) => !selectedComicIds.has(comic.comicId));

  useEffect(() => {
    if (selectedCollectionId && !collections.some((collection) => collection.collectionId === selectedCollectionId)) {
      setSelectedCollectionId("");
    }
  }, [collections, selectedCollectionId]);

  useEffect(() => setSelectedComicId(""), [selectedCollectionId]);

  // Form submit flow: prevent browser reload, call App handler, then App calls
  // catalogApi.addCollection(...) and refreshes data after the backend responds.
  async function handleCreateCollection(event) {
    event.preventDefault();
    setSaving(true);
    setLocalError("");

    try {
      await onCreateCollection(form);
      setSelectedCollectionId("");
      setForm({ collectionName: "" });
      setCreating(false);
    } catch (err) {
      setLocalError(readableError(err));
    } finally {
      setSaving(false);
    }
  }

  // Adds an existing library comic to the selected collection. The backend only
  // needs the collectionId and comicId because comic metadata lives elsewhere.
  async function handleAddComic(event) {
    event.preventDefault();
    if (!selectedCollection || !selectedComicId) return;
    setSaving(true);
    setLocalError("");

    try {
      await onAddComicToCollection(selectedCollection.collectionId, selectedComicId);
      setSelectedComicId("");
    } catch (err) {
      setLocalError(readableError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveComic(comicId) {
    setSaving(true);
    setLocalError("");

    try {
      await onRemoveComicFromCollection(selectedCollection.collectionId, comicId);
    } catch (err) {
      setLocalError(readableError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCollection() {
    if (!confirmDeleteCollection) return;
    setSaving(true);
    setLocalError("");

    try {
      await onDeleteCollection(confirmDeleteCollection);
      setConfirmDeleteCollection(null);
    } catch (err) {
      setLocalError(readableError(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <EmptyState title="Loading collections" text="Fetching your folders." />;

  return (
    <section className="content-stack">
      <div className="collections-toolbar">
        <button type="button" className="primary-button" onClick={() => setCreating((current) => !current)}>
          {creating ? "Close" : "New Collection"}
        </button>
      </div>

      {localError && <InlineError message={localError} />}

      {creating && (
        <form className="collection-form" onSubmit={handleCreateCollection}>
          <TextField label="Collection Name" value={form.collectionName} onChange={(collectionName) => setForm({ ...form, collectionName })} required />
          <div className="button-row full-width">
            <button className="primary-button" disabled={saving || !form.collectionName.trim()}>{saving ? "Saving..." : "Create Collection"}</button>
          </div>
        </form>
      )}

      {collections.length === 0 ? (
        <EmptyState title="No collections yet" text="Create your first collection to start grouping books." />
      ) : (
        <div className="collections-grid">
          {collections.map((collection) => (
            <CollectionCard
              key={collection.collectionId}
              collection={collection}
              active={collection.collectionId === selectedCollection?.collectionId}
              imageVersion={imageVersion}
              onOpen={() => setSelectedCollectionId(collection.collectionId)}
            />
          ))}
        </div>
      )}

      {selectedCollection && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <CollectionDetail
            collection={selectedCollection}
            availableComics={availableComics}
            selectedComicId={selectedComicId}
            saving={saving}
            imageVersion={imageVersion}
            onSelectedComicChange={setSelectedComicId}
            onAddComic={handleAddComic}
            onRemoveComic={handleRemoveComic}
            onClose={() => setSelectedCollectionId("")}
            onDeleteCollection={() => setConfirmDeleteCollection(selectedCollection)}
          />
        </div>
      )}

      {confirmDeleteCollection && (
        <ConfirmDialog
          title="Delete Collection"
          message={`Delete ${confirmDeleteCollection.collectionName}? The books stay in your library.`}
          confirmLabel="Delete Collection"
          onCancel={() => setConfirmDeleteCollection(null)}
          onConfirm={handleDeleteCollection}
        />
      )}
    </section>
  );
}

// CollectionCard is a clickable folder preview. The first four comic covers are
// shown as a 2x2 preview; missing covers fall back to the book icon.
function CollectionCard({ collection, active, imageVersion, onOpen }) {
  const covers = (collection.comics || []).slice(0, 4);

  return (
    <button type="button" className={`collection-card ${active ? "active" : ""}`} onClick={onOpen}>
      <div className="collection-cover-grid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => {
          const comic = covers[index];
          return <CollectionCoverTile key={comic?.comicId || index} comic={comic} imageVersion={imageVersion} />;
        })}
      </div>
      <div className="collection-card-text">
        <h2>{collection.collectionName}</h2>
        <span>{collection.comics?.length || 0} books</span>
      </div>
    </button>
  );
}

// CollectionDetail is the modal for managing one collection: add books, remove
// books, close the modal, or delete the collection.
function CollectionDetail({ collection, availableComics, selectedComicId, saving, imageVersion, onSelectedComicChange, onAddComic, onRemoveComic, onClose, onDeleteCollection }) {
  const [bookSelectOpen, setBookSelectOpen] = useState(false);
  const bookSelectRef = useRef(null);
  const selectedComic = availableComics.find((comic) => comic.comicId === selectedComicId);
  const selectedBookLabel = selectedComic ? `${selectedComic.comicTitle} | #${selectedComic.comicIssue}` : "Choose a book";

  useCloseOnOutsideClick(bookSelectRef, bookSelectOpen, setBookSelectOpen);

  return (
    <section className="collection-detail collection-modal-card">
      <div className="collection-detail-header">
        <div>
          <p className="eyebrow">Collection</p>
          <h2>{collection.collectionName}</h2>
        </div>
        <div className="collection-detail-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Done</button>
          <button type="button" className="danger-button" onClick={onDeleteCollection} disabled={saving}>Delete Collection</button>
        </div>
      </div>

      <form className="collection-add-row" onSubmit={onAddComic}>
        <div className="book-select-control collection-book-select" ref={bookSelectRef}>
          <span className="book-select-label">Add Book</span>
          <button
            type="button"
            className="book-select-trigger"
            onClick={() => setBookSelectOpen((current) => !current)}
            aria-haspopup="listbox"
            aria-expanded={bookSelectOpen}
            disabled={availableComics.length === 0}
          >
            <span>{availableComics.length === 0 ? "No books available" : selectedBookLabel}</span>
            <ChevronDown size={18} />
          </button>

          {bookSelectOpen && (
            <div className="book-select-menu" role="listbox" aria-label="Choose a book for this collection">
              <button type="button" className={selectedComicId === "" ? "selected" : ""} onClick={() => { onSelectedComicChange(""); setBookSelectOpen(false); }} role="option" aria-selected={selectedComicId === ""}>
                <Check size={16} />
                <span>Choose a book</span>
              </button>
              {availableComics.map((comic) => (
                <button type="button" key={comic.comicId} className={comic.comicId === selectedComicId ? "selected" : ""} onClick={() => { onSelectedComicChange(comic.comicId); setBookSelectOpen(false); }} role="option" aria-selected={comic.comicId === selectedComicId}>
                  <Check size={16} />
                  <span>{comic.comicTitle} | #{comic.comicIssue}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="primary-button" disabled={saving || !selectedComicId}>Add to Collection</button>
      </form>

      {(collection.comics || []).length === 0 ? (
        <EmptyState title="No books in this collection" text="Add a book from your library." />
      ) : (
        <div className="collection-book-list">
          {collection.comics.map((comic) => (
            <CollectionBookRow key={comic.comicId} comic={comic} imageVersion={imageVersion} saving={saving} onRemove={() => onRemoveComic(comic.comicId)} />
          ))}
        </div>
      )}
    </section>
  );
}

function CollectionBookRow({ comic, imageVersion, saving, onRemove }) {
  return (
    <article className="collection-book-row">
      <div className="collection-book-cover">
        <CollectionCoverTile comic={comic} imageVersion={imageVersion} />
      </div>
      <div>
        <h3>{comic.comicTitle}</h3>
        <p>Issue #{comic.comicIssue || "—"} · {comic.comicStartYear || "—"}</p>
      </div>
      <RatingStars value={comic.ratingScore || 0} readOnly />
      <button type="button" className="secondary-button" onClick={onRemove} disabled={saving}>Remove</button>
    </article>
  );
}

// Cover tile image flow: if the catalog item has comicImagePath, use the image
// URL from api.js. If the browser fails to load it, switch to the placeholder.
function CollectionCoverTile({ comic, imageVersion }) {
  const [imageError, setImageError] = useState(false);
  const hasCoverImage = Boolean(comic?.comicImagePath) && !imageError;

  useEffect(() => setImageError(false), [comic?.comicId, comic?.comicImagePath, imageVersion]);

  if (!comic) {
    return <div className="collection-cover-tile empty"><BookOpen size={18} /></div>;
  }

  return (
    <div className="collection-cover-tile">
      {hasCoverImage ? <img src={catalogApi.imageUrl(comic.comicId, imageVersion)} alt="" onError={() => setImageError(true)} /> : <BookOpen size={18} />}
    </div>
  );
}

// WantedView lists comics whose backend comicStatus is WANTED. They are kept
// separate from the normal library until the user moves them to Library.
function WantedView({ wantedCatalog, loading, imageVersion, onAddWanted, onOpenWanted }) {
  if (loading) return <EmptyState title="Loading wanted comics" text="Fetching your wanted list." />;

  return (
    <section className="content-stack">
      <div className="wanted-toolbar">
        <button type="button" className="primary-button" onClick={onAddWanted}>Add Wanted Comic</button>
      </div>

      {wantedCatalog.length === 0 ? (
        <EmptyState title="No wanted comics yet" text="Add comics you want to read later." actionLabel="Add Wanted Comic" onAction={onAddWanted} />
      ) : (
        <div className="wanted-grid">
          {wantedCatalog.map((item) => <WantedCard key={item.comicId} item={item} imageVersion={imageVersion} onOpen={() => onOpenWanted(item)} />)}
        </div>
      )}
    </section>
  );
}

function WantedCard({ item, imageVersion, onOpen }) {
  const [imageError, setImageError] = useState(false);
  const hasCoverImage = Boolean(item.comicImagePath) && !imageError;

  useEffect(() => setImageError(false), [item.comicId, item.comicImagePath, imageVersion]);

  return (
    <button type="button" className="wanted-card" onClick={onOpen}>
      <div className="wanted-cover">
        {hasCoverImage ? <img src={catalogApi.imageUrl(item.comicId, imageVersion)} alt={`${item.comicTitle} cover`} onError={() => setImageError(true)} /> : <div className="cover-placeholder"><BookOpen size={28} /></div>}
      </div>
      <h2>{item.comicTitle}</h2>
    </button>
  );
}

// WantedComicModal lets the user inspect a wanted comic and then edit it,
// delete it, or change its status by moving it into the main library.
function WantedComicModal({ item, imageVersion, onClose, onEdit, onMoveToLibrary, onDelete }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const hasCoverImage = Boolean(item.comicImagePath) && !imageError;

  useEffect(() => setImageError(false), [item.comicId, item.comicImagePath, imageVersion]);

  async function handleMoveToLibrary() {
    setSaving(true);
    setError("");
    try {
      await onMoveToLibrary(item);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    setError("");
    try {
      await onDelete(item);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card wanted-modal-card">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Wanted comic</p>
            <h2>{item.comicTitle}</h2>
          </div>
          <button className="icon-button" onClick={onClose} title="Close"><X size={20} /></button>
        </div>

        {error && <InlineError message={error} />}

        <div className="wanted-detail-layout">
          <div className="wanted-detail-cover">
            {hasCoverImage ? <img src={catalogApi.imageUrl(item.comicId, imageVersion)} alt={`${item.comicTitle} cover`} onError={() => setImageError(true)} /> : <div className="cover-placeholder"><BookOpen size={32} /></div>}
          </div>
          <div className="wanted-detail-copy">
            <p className="muted">Issue #{item.comicIssue || "—"} · {item.comicStartYear || "—"}</p>
            <p className="comic-id">Unique ID: {item.comicId}</p>
            {item.comicDesc ? <p className="description freeform">{item.comicDesc}</p> : <p className="muted">No description yet.</p>}
          </div>
        </div>

        <div className="button-row">
          <button className="primary-button" onClick={handleMoveToLibrary} disabled={saving}>{saving ? "Saving..." : "Move to Library"}</button>
          <button className="secondary-button" onClick={() => onEdit(item)} disabled={saving}>Edit Details</button>
          <button className="danger-button" onClick={() => setConfirmDeleteOpen(true)} disabled={saving}>Delete Wanted</button>
        </div>
      </div>

      {confirmDeleteOpen && (
        <ConfirmDialog
          title="Delete Wanted Comic"
          message={`Delete ${item.comicTitle} from Wanted? This removes the comic entry entirely.`}
          confirmLabel="Delete Wanted"
          onCancel={() => setConfirmDeleteOpen(false)}
          onConfirm={() => { setConfirmDeleteOpen(false); handleDelete(); }}
        />
      )}
    </div>
  );
}

// AddWantedView uses the same reusable comic form as AddComicView, but sends
// the JSON to the wanted endpoint so the backend stores it with WANTED status.
function AddWantedView({ onCancel, onCreated }) {
  const [createdComic, setCreatedComic] = useState(null);

  // Create wanted comic flow: first save JSON, then upload the optional image.
  // If image upload fails, delete the just-created comic to avoid a half-saved
  // frontend/backend state.
  async function createWantedComic(form, coverImage) {
    const created = await catalogApi.addWantedComic(form);
    try {
      if (coverImage) await catalogApi.addComicImage(created.comicId, coverImage);
    } catch (err) {
      await catalogApi.deleteComic(created.comicId).catch(() => {});
      throw new Error(`Wanted comic was not saved because the cover image failed to upload. ${readableError(err)}`);
    }
    setCreatedComic(created);
    onCreated(created);
    return created;
  }

  if (createdComic) {
    return (
      <SuccessPanel
        title={`${createdComic.comicTitle} was added to Wanted`}
        text="The comic is saved for later."
        primaryLabel="Back to Wanted"
        onPrimary={onCancel}
        secondaryLabel="Add another wanted comic"
        onSecondary={() => setCreatedComic(null)}
      />
    );
  }

  return (
    <ComicFormView
      eyebrow="Wanted comic"
      title="Add Wanted Comic"
      submitLabel="Save Wanted Comic"
      initialForm={emptyComic}
      coverTitle="Upload Cover"
      coverActionText="Click or drag to upload cover image"
      onCancel={onCancel}
      onSubmit={createWantedComic}
    />
  );
}

// CatalogCard renders one library comic. Its item is a CatalogItem from the
// catalog backend: comic fields plus optional rating fields in one object.
function CatalogCard({ item, onDeleteComic, onManageRating, onEditComic, onAddRating, imageVersion }) {
  const [open, setOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [reviewExpanded, setReviewExpanded] = useState(false);
  const [reviewCanExpand, setReviewCanExpand] = useState(false);
  const ref = useRef(null);
  const reviewRef = useRef(null);
  const [imageError, setImageError] = useState(false);
  const hasRating = item.ratingScore != null;
  const hasCoverImage = Boolean(item.comicImagePath) && !imageError;
  useCloseOnOutsideClick(ref, open, setOpen);

  useEffect(() => setImageError(false), [item.comicId, item.comicImagePath, imageVersion]);
  useEffect(() => setReviewExpanded(false), [item.comicId, item.ratingReview]);

  useEffect(() => {
    const review = reviewRef.current;
    if (!review) {
      setReviewCanExpand(false);
      return;
    }
    const wasExpanded = review.classList.contains("expanded");
    review.classList.remove("expanded");
    review.classList.add("collapsed");
    setReviewCanExpand(review.scrollHeight > review.clientHeight + 1);
    if (wasExpanded) {
      review.classList.remove("collapsed");
      review.classList.add("expanded");
    }
  }, [item.ratingReview]);

  return (
    <article className="catalog-card" ref={ref}>
      <div className="cover-thumb">
        {hasCoverImage ? <img src={catalogApi.imageUrl(item.comicId, imageVersion)} alt={`${item.comicTitle} cover`} onError={() => setImageError(true)} /> : <div className="cover-placeholder"><BookOpen size={24} /></div>}
      </div>

      <div className="card-main">
        <div>
          <h2>{item.comicTitle}</h2>
          <p className="muted">Issue #<span className="kv">{item.comicIssue || "—"}</span> · <span className="kv">{item.comicStartYear || "—"}</span></p>
          <p className="comic-id">Unique ID: {item.comicId}</p>
        </div>
        <RatingStars value={item.ratingScore || 0} readOnly />
      </div>

      {item.comicDesc && <p className="description">{item.comicDesc}</p>}
      {item.ratingReview && <p ref={reviewRef} className={`review ${reviewExpanded ? "expanded" : "collapsed"}`}>&quot;{item.ratingReview}&quot;</p>}

      {reviewCanExpand && (
        <button type="button" className="review-toggle" onClick={() => setReviewExpanded((current) => !current)} aria-expanded={reviewExpanded}>
          <ChevronDown size={16} />
          {reviewExpanded ? "Show less" : "Show more"}
        </button>
      )}

      <div className="card-menu">
        <button className="icon-button" onClick={() => setOpen((current) => !current)} title="Comic actions"><MoreVertical size={20} /></button>
        {open && (
          <div className="menu-popover">
            <button onClick={() => onEditComic(item)}><Pencil size={16} />Edit Book</button>
            <button onClick={() => onManageRating(item)}><Star size={16} />{hasRating ? "Manage Rating" : "Quick Rate"}</button>
            <button className="danger" onClick={() => { setOpen(false); setConfirmDeleteOpen(true); }}><Trash2 size={16} />Delete Book</button>
          </div>
        )}
      </div>

      {confirmDeleteOpen && (
        <ConfirmDialog
          title="Delete Book"
          message={`Delete ${item.comicTitle}? This is permanent.`}
          confirmLabel="Delete Book"
          onCancel={() => setConfirmDeleteOpen(false)}
          onConfirm={() => { setConfirmDeleteOpen(false); onDeleteComic(item); }}
        />
      )}
    </article>
  );
}

// Shared dropdown helper. When a menu is open, listen for document clicks and
// close the menu if the click lands outside the referenced element.
function useCloseOnOutsideClick(ref, open, setOpen) {
  useEffect(() => {
    function onDoc(event) {
      if (!open || !ref.current) return;
      if (!ref.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [ref, open, setOpen]);
}

// AddComicView creates normal library comics. It wraps ComicFormView with the
// backend-specific submit behavior for POST /catalog/comics.
function AddComicView({ onCancel, onCreated, onRateNewComic }) {
  const [createdComic, setCreatedComic] = useState(null);

  // Create comic flow: save comic JSON first so the backend generates comicId,
  // then use that returned comicId to upload the optional image file.
  async function createComic(form, coverImage) {
    const created = await catalogApi.addComic(form);
    try {
      if (coverImage) await catalogApi.addComicImage(created.comicId, coverImage);
    } catch (err) {
      await catalogApi.deleteComic(created.comicId).catch(() => {});
      throw new Error(`Book was not saved because the cover image failed to upload. ${readableError(err)}`);
    }
    setCreatedComic(created);
    onCreated(created);
    return created;
  }

  if (createdComic) {
    return (
      <SuccessPanel
        title={`${createdComic.comicTitle} was added`}
        text="The book is in your library."
        primaryLabel="Rate This Book"
        onPrimary={() => onRateNewComic(createdComic.comicId)}
        secondaryLabel="Back Home"
        onSecondary={onCancel}
        tertiaryLabel="Add another book"
        onTertiary={() => setCreatedComic(null)}
      />
    );
  }

  return (
    <ComicFormView
      eyebrow="New book"
      title="Add a Book"
      submitLabel="Save Book"
      initialForm={emptyComic}
      coverTitle="Upload Cover"
      coverActionText="Click or drag to upload cover image"
      onCancel={onCancel}
      onSubmit={createComic}
    />
  );
}

// EditComicView prepares an existing catalog item for the reusable form and
// sends PUT/DELETE image requests only when cover changes are requested.
function EditComicView({ item, imageVersion, onCancel, onSaved }) {
  const initialForm = {
    comicTitle: item.comicTitle || "",
    comicIssue: item.comicIssue || "",
    comicStartYear: item.comicStartYear || "",
    comicDesc: item.comicDesc || ""
  };

  async function updateComic(form, coverImage, removeExistingCover) {
    const updated = await catalogApi.updateComic(item.comicId, { ...form, comicStatus: item.comicStatus });
    if (removeExistingCover) await catalogApi.deleteComicImage(item.comicId);
    if (coverImage) await catalogApi.updateComicImage(item.comicId, coverImage);
    onSaved(updated);
    return updated;
  }

  return (
    <ComicFormView
      eyebrow="Update book"
      title="Edit Book"
      submitLabel="Update Book"
      initialForm={initialForm}
      existingImageUrl={item.comicImagePath ? catalogApi.imageUrl(item.comicId, imageVersion) : ""}
      coverTitle="Edit Cover"
      coverActionText="Click or drag to replace cover image"
      onCancel={onCancel}
      onSubmit={updateComic}
    />
  );
}

// ComicFormView is shared by add/edit/wanted forms. It only manages form input
// and cover preview state; the parent decides which API endpoint to call.
function ComicFormView({ eyebrow, title, submitLabel, initialForm, existingImageUrl = "", coverTitle, coverActionText, onCancel, onSubmit }) {
  const [form, setForm] = useState(initialForm);
  const [coverImage, setCoverImage] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [removeExistingCover, setRemoveExistingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(initialForm);
    setCoverImage(null);
    setCoverPreview("");
    setRemoveExistingCover(false);
  }, [initialForm.comicTitle, initialForm.comicIssue, initialForm.comicStartYear, initialForm.comicDesc]);

  useEffect(() => {
    if (!coverImage) {
      setCoverPreview("");
      return;
    }
    const previewUrl = URL.createObjectURL(coverImage);
    setCoverPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [coverImage]);

  // Browser forms normally refresh the page. preventDefault keeps React in
  // control, then calls the parent-provided onSubmit function.
  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit(form, coverImage, removeExistingCover);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSaving(false);
    }
  }

  function handleCoverChange(file) {
    if (file && !isSupportedCoverImage(file)) {
      setCoverImage(null);
      setError("Cover image must be a JPG, JPEG, or PNG file.");
      return;
    }
    setError("");
    setCoverImage(file);
    if (file) setRemoveExistingCover(false);
  }

  return (
    <section className="add-comic-layout">
      <div className="form-panel add-comic">
        <div className="section-heading">
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>

        {error && <InlineError message={error} />}

        <form onSubmit={handleSubmit} className="form-grid">
          <TextField label="Title" value={form.comicTitle} onChange={(comicTitle) => setForm({ ...form, comicTitle })} required />
          <TextField label="Issue Number" value={form.comicIssue} onChange={(comicIssue) => setForm({ ...form, comicIssue })} required />
          <TextField label="Start Year" value={form.comicStartYear} onChange={(comicStartYear) => setForm({ ...form, comicStartYear })} inputMode="numeric" />
          <TextArea label="Description" value={form.comicDesc} onChange={(comicDesc) => setForm({ ...form, comicDesc })} />

          <div className="button-row">
            <button className="primary-button" disabled={saving}>{saving ? "Saving..." : submitLabel}</button>
            <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </div>

      <CoverUploadCard
        title={coverTitle}
        actionText={coverActionText}
        coverImage={coverImage}
        coverPreview={coverPreview}
        existingImageUrl={removeExistingCover ? "" : existingImageUrl}
        onChange={handleCoverChange}
        onClear={() => setCoverImage(null)}
        onRemoveExisting={existingImageUrl ? () => { setCoverImage(null); setRemoveExistingCover(true); } : null}
      />
    </section>
  );
}

// CoverUploadCard handles file picking and drag/drop. It does not upload by
// itself; it passes the selected File object back to ComicFormView.
function CoverUploadCard({ title, actionText, coverImage, coverPreview, existingImageUrl, onChange, onClear, onRemoveExisting }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const shownImage = coverPreview || existingImageUrl;

  function handleDroppedFile(event) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onChange(file);
  }

  return (
    <aside className="cover-upload-card">
      <div>
        <p className="eyebrow">Cover image</p>
        <h2>{title}</h2>
      </div>

      <button
        type="button"
        className={`cover-dropzone ${dragging ? "dragging" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDroppedFile}
      >
        {shownImage ? <img src={shownImage} alt="Selected comic cover preview" /> : <span><Upload size={32} /><strong>{actionText}</strong><small>JPG, JPEG, or PNG</small></span>}
      </button>

      <input ref={inputRef} className="hidden-file-input" type="file" accept="image/jpeg,image/png" onChange={(event) => onChange(event.target.files?.[0] || null)} />

      <div className="cover-actions">
        <button type="button" className="secondary-button" onClick={() => inputRef.current?.click()}>{shownImage ? "Change Cover Image" : "Choose Image"}</button>
        {coverImage && <button type="button" className="danger-button" onClick={onClear}>Remove Selected</button>}
        {!coverImage && existingImageUrl && onRemoveExisting && <button type="button" className="danger-button" onClick={onRemoveExisting}>Remove Cover Image</button>}
      </div>
    </aside>
  );
}

// AddRatingView lets the user choose a library comic, preview its cover, and
// POST a rating. Already-rated comics redirect into the manage-rating modal.
function AddRatingView({ catalog, prefilledComicId, onCancel, onCreated, onManageExisting }) {
  const [selectedComicId, setSelectedComicId] = useState(prefilledComicId || "");
  const [rating, setRating] = useState(emptyRating);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedImageError, setSelectedImageError] = useState(false);
  const [bookSelectOpen, setBookSelectOpen] = useState(false);
  const bookSelectRef = useRef(null);

  const selectedComic = useMemo(() => catalog.find((item) => item.comicId === selectedComicId), [catalog, selectedComicId]);
  const alreadyRated = selectedComic?.ratingId != null;
  const selectedComicHasCover = Boolean(selectedComic?.comicImagePath) && !selectedImageError;
  const selectedBookLabel = selectedComic ? `${selectedComic.comicTitle} | #${selectedComic.comicIssue}` : "Choose a book";

  useCloseOnOutsideClick(bookSelectRef, bookSelectOpen, setBookSelectOpen);
  useEffect(() => setSelectedImageError(false), [selectedComicId, selectedComic?.comicImagePath]);

  // Rating submit flow: prevent browser reload, validate the selected comic,
  // then send POST /catalog/ratings through api.js. If the comic already has a
  // rating, this opens the manage-rating modal instead of creating a duplicate.
  async function handleSubmit(event) {
    event.preventDefault();
    if (!selectedComicId) {
      setError("Choose a comic first.");
      return;
    }
    if (alreadyRated) {
      onManageExisting(selectedComic);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const created = await catalogApi.addRating({ comicId: selectedComicId, ratingScore: rating.ratingScore, ratingReview: rating.ratingReview });
      setRating(emptyRating);
      onCreated(created);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="form-panel wide">
      <div className="section-heading"><p className="eyebrow">New rating</p><h2>Add a Rating</h2></div>
      {error && <InlineError message={error} />}

      <form onSubmit={handleSubmit} className="rating-layout">
        <div className="rating-selector-column">
          <div className="book-select-control" ref={bookSelectRef}>
            <button type="button" className="book-select-trigger" onClick={() => setBookSelectOpen((current) => !current)} aria-haspopup="listbox" aria-expanded={bookSelectOpen}>
              <span>{selectedBookLabel}</span>
              <ChevronDown size={18} />
            </button>
            {bookSelectOpen && (
              <div className="book-select-menu" role="listbox" aria-label="Choose a book">
                <button type="button" className={selectedComicId === "" ? "selected" : ""} onClick={() => { setSelectedComicId(""); setBookSelectOpen(false); }} role="option" aria-selected={selectedComicId === ""}>
                  <Check size={16} />
                  <span>Choose a book</span>
                </button>
                {catalog.map((item) => (
                  <button type="button" key={item.comicId} className={item.comicId === selectedComicId ? "selected" : ""} onClick={() => { setSelectedComicId(item.comicId); setBookSelectOpen(false); }} role="option" aria-selected={item.comicId === selectedComicId}>
                    <Check size={16} />
                    <span>{item.comicTitle} | #{item.comicIssue}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedComic && (
            <div className="selected-cover-preview">
              {selectedComicHasCover ? <img src={catalogApi.imageUrl(selectedComic.comicId, selectedComic.comicImagePath)} alt={`${selectedComic.comicTitle} cover`} onError={() => setSelectedImageError(true)} /> : <div className="cover-placeholder"><BookOpen size={28} /><span>No cover image</span></div>}
            </div>
          )}
        </div>

        <div className="rating-form-area">
          {selectedComic ? (
            <>
              <div className="selected-comic"><h3>{selectedComic.comicTitle}</h3><p>Issue #{selectedComic.comicIssue} · Unique ID: {selectedComic.comicId}</p></div>
              <InteractiveStars value={alreadyRated ? selectedComic.ratingScore : rating.ratingScore} onChange={(ratingScore) => setRating({ ...rating, ratingScore })} disabled={alreadyRated} />
              <TextArea label="Review" value={alreadyRated ? selectedComic.ratingReview || "" : rating.ratingReview} onChange={(ratingReview) => setRating({ ...rating, ratingReview })} disabled={alreadyRated} maxLength={2000} />
              {alreadyRated && <InlineError message="This comic already has a rating. Use Manage Rating to edit it." />}
            </>
          ) : (
            <EmptyState title="Choose a book" text="Select a book from your library." />
          )}
        </div>

        <div className="button-row full-width">
          <button className="primary-button" disabled={saving || !selectedComicId || (!alreadyRated && rating.ratingScore === 0)}>{alreadyRated ? "Manage Existing Rating" : saving ? "Saving..." : "Save Rating"}</button>
          <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </section>
  );
}

// RatingModal supports both creating and updating/deleting a rating from a
// library card. It chooses POST or PUT based on whether ratingId exists.
function RatingModal({ item, onClose, onSaved }) {
  const hasRating = item.ratingId != null;
  const [rating, setRating] = useState({ ratingScore: item.ratingScore || 0, ratingReview: item.ratingReview || "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  async function saveRating() {
    if (rating.ratingScore === 0) {
      setError("Choose a rating from 1 to 10.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (hasRating) {
        await catalogApi.updateRating(item.ratingId, rating);
        onSaved("Rating updated.");
      } else {
        await catalogApi.addRating({ comicId: item.comicId, ...rating });
        onSaved("Rating added.");
      }
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteRating() {
    setSaving(true);
    setError("");
    try {
      await catalogApi.deleteRating(item.ratingId);
      onSaved("Rating deleted.");
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header"><div><p className="eyebrow">Rating</p><h2>{item.comicTitle}</h2></div><button className="icon-button" onClick={onClose} title="Close"><X size={20} /></button></div>
        {error && <InlineError message={error} />}
        <InteractiveStars value={rating.ratingScore} onChange={(ratingScore) => setRating({ ...rating, ratingScore })} />
        <TextArea label="Review (max 2000 characters)" value={rating.ratingReview} onChange={(ratingReview) => setRating({ ...rating, ratingReview })} maxLength={2000} />
        <div className="button-row">
          <button className="primary-button" onClick={saveRating} disabled={saving}>{saving ? "Saving..." : hasRating ? "Update Rating" : "Add Rating"}</button>
          {hasRating && <button className="danger-button" onClick={() => setConfirmDeleteOpen(true)} disabled={saving}>Delete Rating</button>}
          <button className="secondary-button" onClick={onClose}>Cancel</button>
        </div>
      </div>

      {confirmDeleteOpen && <ConfirmDialog title="Delete Rating" message={`Do you want to delete your rating for ${item.comicTitle}? This action is permanent.`} confirmLabel="Delete Rating" onCancel={() => setConfirmDeleteOpen(false)} onConfirm={() => { setConfirmDeleteOpen(false); deleteRating(); }} />}
    </div>
  );
}

// ConfirmDialog is reused for destructive actions so delete operations always
// require an explicit confirmation click.
function ConfirmDialog({ title, message, confirmLabel, onCancel, onConfirm }) {
  return (
    <div className="confirm-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="confirm-card">
        <div className="confirm-icon"><AlertTriangle size={24} /></div>
        <div><p className="eyebrow">Confirm action</p><h2 id="confirm-title">{title}</h2><p>{message}</p></div>
        <div className="button-row confirm-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="button" className="danger-button" onClick={onConfirm}>{confirmLabel}</button></div>
      </div>
    </div>
  );
}

// Read-only star display. The number inside the last filled star shows the
// exact score while still giving a quick visual 1-10 scale.
function RatingStars({ value }) {
  const score = Math.max(0, Math.min(10, Number(value) || 0));
  return (
    <div className="stars" aria-label={`${score} out of 10`}>
      {Array.from({ length: 10 }, (_, index) => {
        const starNumber = index + 1;
        const filled = starNumber <= score;
        const showScore = filled && starNumber === score;
        return <span key={starNumber} className="star-shell"><Star size={22} fill={filled ? "currentColor" : "none"} className={filled ? "filled" : ""} />{showScore && <span className="star-score">{score}</span>}</span>;
      })}
    </div>
  );
}

// InteractiveStars overlays invisible buttons on top of the read-only stars so
// clicks and keyboard focus update the numeric rating value.
function InteractiveStars({ value, onChange, disabled = false }) {
  const [hovered, setHovered] = useState(0);
  const shownValue = hovered || value || 0;
  return (
    <div className="interactive-stars">
      <RatingStars value={shownValue} />
      <div className="star-buttons">
        {Array.from({ length: 10 }, (_, index) => {
          const score = index + 1;
          return <button key={score} type="button" disabled={disabled} onMouseEnter={() => setHovered(score)} onMouseLeave={() => setHovered(0)} onFocus={() => setHovered(score)} onBlur={() => setHovered(0)} onClick={() => onChange(score)} aria-label={`${score} stars`} />;
        })}
      </div>
      <strong>{shownValue}/10</strong>
    </div>
  );
}

function TextField({ label, value, onChange, required = false, inputMode = "text" }) {
  return <label className="text-field"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} required={required} inputMode={inputMode} /></label>;
}

function TextArea({ label, value, onChange, disabled = false, maxLength }) {
  return <label className="text-field textarea-field"><span>{label}</span><textarea value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} rows={5} maxLength={maxLength || 2000} /></label>;
}

function InlineError({ message }) {
  return <div className="inline-error"><AlertTriangle size={16} /><span>{message}</span></div>;
}

function EmptyState({ title, text, actionLabel, onAction }) {
  return <div className="empty-state"><Library size={36} /><h2>{title}</h2><p>{text}</p>{actionLabel && <button className="primary-button" onClick={onAction}>{actionLabel}</button>}</div>;
}

function SuccessPanel({ title, text, primaryLabel, onPrimary, secondaryLabel, onSecondary, tertiaryLabel, onTertiary }) {
  return (
    <section className="success-panel">
      <div className="success-icon"><Check size={34} /></div>
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="button-row centered">
        <button className="primary-button" onClick={onPrimary}>{primaryLabel}</button>
        <button className="secondary-button" onClick={onSecondary}>{secondaryLabel}</button>
        {tertiaryLabel && onTertiary && <button className="secondary-button" onClick={onTertiary}>{tertiaryLabel}</button>}
      </div>
    </section>
  );
}

// Converts thrown API errors into short text that can be shown in banners.
function readableError(error) {
  if (!error) return "Something went wrong.";
  if (error.status) return `${error.status}: ${error.message}`;
  return error.message || "Something went wrong.";
}
