import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud, FileText, Image as ImageIcon, ScanLine, AlertTriangle, CheckCircle2,
  Sparkles, ShieldCheck, PencilLine, ArrowRight, FileWarning,
} from 'lucide-react';
import { Page, Card, CardHead, InfoCallout, EmptyState, Field } from '../components/ui';
import { useStore } from '../demo/store';
import { formatDate, formatPKR } from '../lib/format';
import type { DemoDocument, JournalLine } from '../demo/types';

const KIND_LABEL: Record<DemoDocument['kind'], string> = {
  'bank-slip': 'Bank deposit slip',
  'payment-receipt': 'Payment receipt',
  'purchase-invoice': 'Purchase invoice',
  'sales-invoice': 'Sales invoice',
};

interface EditState {
  partyId: string;
  amount: number;
  date: string;
  reference: string;
}

export default function Documents() {
  const { data, addDocument, updateDocument, createApproval, pushToast, addActivity } = useStore();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string>(data.documents[0]?.id ?? '');
  const [drag, setDrag] = useState(false);
  // Blob preview URLs die when the tab that created them is closed, so a saved
  // upload can come back with a dead URL after a later browser session.
  const [previewBroken, setPreviewBroken] = useState(false);
  const selected = data.documents.find((d) => d.id === selectedId);

  useEffect(() => {
    setPreviewBroken(false);
  }, [selectedId]);

  const [edit, setEdit] = useState<EditState | null>(null);
  const activeEdit: EditState | null = useMemo(() => {
    if (edit) return edit;
    if (!selected) return null;
    return {
      partyId: selected.extraction.partyId ?? '',
      amount: selected.extraction.amount,
      date: selected.extraction.date,
      reference: selected.extraction.reference ?? '',
    };
  }, [edit, selected]);

  const onFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    const file = files[0]!;
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    if (!isImage && !isPdf) {
      pushToast({ title: 'Unsupported file type', text: 'Upload a PDF or an image (PNG/JPG).', tone: 'error' });
      return;
    }
    if (file.size === 0) {
      pushToast({ title: 'Empty file', text: 'That file is 0 bytes — pick a real PDF or image.', tone: 'error' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      pushToast({ title: 'File too large', text: `Demo uploads are limited to 10 MB (this one is ${Math.round(file.size / (1024 * 1024))} MB).`, tone: 'error' });
      return;
    }
    const duplicateName = data.documents.some((d) => d.name === file.name);
    const doc: DemoDocument = {
      id: `DOC-${Date.now()}`,
      name: file.name,
      kind: 'bank-slip',
      uploadedAt: new Date().toISOString(),
      uploadedBy: 'Demo User',
      sizeLabel: `${Math.max(1, Math.round(file.size / 1024))} KB`,
      isSample: false,
      status: 'extracted',
      extraction: {
        documentType: 'Unclassified upload',
        partyName: '—',
        amount: 0,
        date: data.demoToday,
        confidence: 0,
        missingFields: ['Party', 'Amount', 'Date', 'Reference No.'],
      },
      fileUrl: URL.createObjectURL(file),
    };
    addDocument(doc);
    setSelectedId(doc.id);
    setEdit(null);
    addActivity({
      at: new Date().toISOString(),
      actor: 'user',
      tone: 'info',
      title: 'Document uploaded',
      detail: `${file.name} · awaiting manual field entry (OCR not connected)`,
    });
    pushToast({
      title: duplicateName ? 'Document added · duplicate name' : 'Document added',
      text: duplicateName
        ? 'A document with this name is already in the library — this is a separate copy. OCR is not connected, so no fields were read.'
        : 'OCR is not connected in this demo, so no fields were read. Enter the values manually or open a bundled sample.',
      tone: 'info',
    });
  };

  const createDraft = () => {
    if (!selected || !activeEdit) return;
    if (!activeEdit.amount || activeEdit.amount <= 0) {
      pushToast({ title: 'Amount required', text: 'Enter the document amount before creating a draft.', tone: 'error' });
      return;
    }
    const party = data.parties.find((p) => p.id === activeEdit.partyId);
    const isPurchase = selected.kind === 'purchase-invoice';
    const isSales = selected.kind === 'sales-invoice';
    let lines: JournalLine[];
    let type: 'receipt' | 'purchase' | 'sales';
    let title: string;
    let accountId: string;

    if (isPurchase) {
      type = 'purchase';
      accountId = '2000';
      lines = [
        { accountId: '1200', debit: activeEdit.amount, credit: 0 },
        { accountId: '2000', debit: 0, credit: activeEdit.amount, partyId: party?.id },
      ];
      title = `Purchase invoice — ${party?.name ?? 'Unassigned supplier'} — ${formatPKR(activeEdit.amount)}`;
    } else if (isSales) {
      type = 'sales';
      accountId = '1100';
      lines = [
        { accountId: '1100', debit: activeEdit.amount, credit: 0, partyId: party?.id },
        { accountId: '4000', debit: 0, credit: activeEdit.amount },
        { accountId: '5000', debit: Math.round(activeEdit.amount * 0.7), credit: 0 },
        { accountId: '1200', debit: 0, credit: Math.round(activeEdit.amount * 0.7) },
      ];
      title = `Sales invoice — ${party?.name ?? 'Unassigned customer'} — ${formatPKR(activeEdit.amount)}`;
    } else {
      type = 'receipt';
      accountId = '1010';
      lines = [
        { accountId: '1010', debit: activeEdit.amount, credit: 0 },
        { accountId: '1100', debit: 0, credit: activeEdit.amount, partyId: party?.id },
      ];
      title = `Bank slip / receipt — ${party?.name ?? 'Unassigned customer'} — ${formatPKR(activeEdit.amount)}`;
    }

    const uncertainties = [
      ...selected.extraction.missingFields.map((f) => `${f} was not detected — please confirm`),
      ...(selected.isSample ? [] : ['OCR is not connected: values were entered manually']),
    ];

    const approval = createApproval({
      title,
      subtitle: `Extracted from ${selected.name} (simulated extraction)`,
      origin: 'document',
      draft: {
        type,
        date: activeEdit.date,
        amount: activeEdit.amount,
        partyId: party?.id,
        accountId,
        description: `${KIND_LABEL[selected.kind]} — ${party?.name ?? 'unassigned party'}${activeEdit.reference ? ` (ref ${activeEdit.reference})` : ''}`,
        lines,
      },
      confidence: selected.extraction.confidence,
      uncertainties,
      documentId: selected.id,
    });

    updateDocument(selected.id, { status: 'draft-created' });
    addActivity({
      at: new Date().toISOString(),
      actor: 'ai',
      tone: 'warning',
      title: 'Document turned into a draft',
      detail: `${selected.name} · ${formatPKR(activeEdit.amount)} · awaiting approval`,
    });
    pushToast({
      title: 'Transaction draft created',
      text: `${approval.reference} is now pending approval. Nothing has been posted to the ledger yet.`,
      tone: 'info',
    });
    navigate('/approvals');
  };

  return (
    <Page
      eyebrow="Automation"
      title="Document Intelligence"
      subtitle="Upload a bank slip, receipt or invoice and turn it into a transaction draft — with explicit approval before anything posts."
      actions={<span className="badge amber"><ScanLine size={12} /> Simulated OCR · not connected</span>}
    >
      <div className="grid-sidebar-left" style={{ marginBottom: 16 }}>
        <div className="stack">
          <Card>
            <CardHead title="Upload a document" sub="PDF, JPG or PNG · demo only, files stay in your browser" icon={<UploadCloud size={15} />} />
            <div className="card-body">
              <div
                className={`upload-zone ${drag ? 'drag' : ''}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files); }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
              >
                <div className="empty-icon" style={{ margin: '0 auto 8px' }}><UploadCloud size={20} /></div>
                <div className="bold">Click to upload or drag a file here</div>
                <div className="xsmall muted mt-2">Bank slip · payment receipt · purchase invoice · sales invoice</div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }}
              />
              <div className="mt-3">
                <InfoCallout tone="warn" title="No OCR engine in this demo">
                  Fields are never invented for your own file. Sample documents ship with clearly-labelled simulated
                  extractions; for uploads you type the values yourself.
                </InfoCallout>
              </div>
            </div>
          </Card>

          <Card>
            <CardHead title="Document library" sub={`${data.documents.length} documents`} icon={<FileText size={15} />} />
            <div className="card-body" style={{ padding: '10px 12px' }}>
              {data.documents.map((d) => (
                <div
                  key={d.id}
                  className="row"
                  style={{
                    gap: 10, padding: '9px 10px', borderRadius: 10, cursor: 'pointer',
                    background: d.id === selectedId ? 'var(--blue-50)' : 'transparent',
                    border: `1px solid ${d.id === selectedId ? '#d5e5ff' : 'transparent'}`,
                  }}
                  onClick={() => { setSelectedId(d.id); setEdit(null); }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedId(d.id)}
                >
                  <div className="kpi-icon navy" style={{ width: 28, height: 28 }}>
                    {d.name.toLowerCase().endsWith('.pdf') ? <FileText size={14} /> : <ImageIcon size={14} />}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="small bold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                    <div className="xsmall muted">{KIND_LABEL[d.kind]} · {d.sizeLabel} · {d.isSample ? 'Bundled sample' : 'Your upload'}</div>
                  </div>
                  <span className={`badge ${d.status === 'posted' ? 'green' : d.status === 'draft-created' ? 'amber' : 'outline'}`}>
                    {d.status === 'posted' ? 'Posted' : d.status === 'draft-created' ? 'Draft created' : 'Extracted'}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="stack">
          {selected ? (
            <>
              <Card>
                <CardHead
                  title="Document preview"
                  sub={`${selected.name} · ${selected.isSample ? 'bundled sample document' : 'your upload — preview only'}`}
                  actions={<span className="badge outline">{KIND_LABEL[selected.kind]}</span>}
                />
                <div className="card-body">
                  {selected.isSample ? (
                    <SamplePreview doc={selected} />
                  ) : previewBroken || !selected.fileUrl ? (
                    <EmptyState
                      title="No preview available"
                      text={selected.fileUrl
                        ? 'The saved preview expired when this browser session ended — the file was never uploaded to a server. Re-upload it to preview again; the document record and its fields are still saved.'
                        : 'The file could not be previewed in this browser.'}
                      icon={<FileWarning size={20} />}
                    />
                  ) : selected.name.toLowerCase().match(/\.(png|jpg|jpeg|webp|gif)$/) ? (
                    <img
                      src={selected.fileUrl} alt={selected.name}
                      onError={() => setPreviewBroken(true)}
                      style={{ width: '100%', borderRadius: 12, border: '1px solid var(--border)' }}
                    />
                  ) : (
                    <iframe
                      src={selected.fileUrl} title={selected.name}
                      onError={() => setPreviewBroken(true)}
                      style={{ width: '100%', height: 380, border: '1px solid var(--border)', borderRadius: 12 }}
                    />
                  )}
                </div>
              </Card>

              <Card>
                <CardHead
                  title="Extracted fields"
                  sub={selected.isSample ? 'Simulated extraction from the bundled sample' : 'No OCR result — enter values manually'}
                  icon={<Sparkles size={15} />}
                  actions={
                    <span className={`badge ${selected.extraction.confidence > 0.9 ? 'green' : selected.extraction.confidence > 0 ? 'amber' : 'red'}`}>
                      {selected.extraction.confidence > 0 ? `Confidence ${(selected.extraction.confidence * 100).toFixed(0)}%` : 'No confidence'}
                    </span>
                  }
                />
                <div className="card-body">
                  {!selected.isSample ? (
                    <div className="mb-3">
                      <InfoCallout tone="warn" title="Manual entry">
                        OCR/Vision is not implemented in this demo, so nothing was read from your file. Fill in the fields
                        below to prepare a draft.
                      </InfoCallout>
                    </div>
                  ) : null}

                  <div className="grid grid-2">
                    <Field label="Party">
                      <select className="select" value={activeEdit?.partyId ?? ''} onChange={(e) => setEdit({ ...activeEdit!, partyId: e.target.value })}>
                        <option value="">— select party —</option>
                        {data.parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Amount (PKR)">
                      <input
                        className="input tnum"
                        type="number"
                        value={activeEdit?.amount || ''}
                        onChange={(e) => setEdit({ ...activeEdit!, amount: Number(e.target.value) })}
                        placeholder="0"
                      />
                    </Field>
                    <Field label="Document date">
                      <input className="input" type="date" value={activeEdit?.date ?? data.demoToday} max={data.demoToday}
                        onChange={(e) => setEdit({ ...activeEdit!, date: e.target.value })} />
                    </Field>
                    <Field label="Reference no.">
                      <input className="input" value={activeEdit?.reference ?? ''} onChange={(e) => setEdit({ ...activeEdit!, reference: e.target.value })} placeholder="e.g. HBL-SLIP-4417" />
                    </Field>
                  </div>

                  <div className="mt-3">
                    {selected.extraction.missingFields.length > 0 ? (
                      <div className="callout warn" style={{ marginBottom: 10 }}>
                        <AlertTriangle size={15} />
                        <div>
                          <strong>Uncertain fields:</strong> {selected.extraction.missingFields.join(', ')}
                        </div>
                      </div>
                    ) : (
                      <div className="callout success" style={{ marginBottom: 10 }}>
                        <CheckCircle2 size={15} />
                        <div>All key fields detected in the sample extraction.</div>
                      </div>
                    )}
                  </div>

                  <div className="demo-pill" style={{ marginBottom: 10 }}>
                    <span className="demo-dot" /> Simulated extraction — not produced by a real OCR engine
                  </div>

                  <button className="btn primary block" onClick={createDraft}>
                    <PencilLine size={15} /> Prepare transaction draft
                  </button>
                  <div className="xsmall muted mt-2" style={{ display: 'flex', gap: 6 }}>
                    <ShieldCheck size={12} /> The draft is never posted automatically — it waits in Approvals for a human decision.
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <Card><EmptyState title="No document selected" text="Choose a document from the library or upload one." /></Card>
          )}

          <Card>
            <CardHead title="How this demo works" sub="For the client walkthrough" icon={<ShieldCheck size={15} />} />
            <div className="card-body">
              <ol className="small" style={{ paddingLeft: 18, margin: 0, display: 'grid', gap: 7 }}>
                <li>Pick a bundled sample (its extraction is simulated and labelled).</li>
                <li>Review or correct the fields — including anything flagged as uncertain.</li>
                <li>Prepare a transaction draft; the app opens Approvals with the draft pending.</li>
                <li>Approve it — only then does the voucher post and every KPI update.</li>
              </ol>
              <button className="btn sm mt-3" onClick={() => navigate('/approvals')}>
                Open approvals <ArrowRight size={13} />
              </button>
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Fake-but-clearly-labelled sample document preview (SVG)             */
/* ------------------------------------------------------------------ */
function SamplePreview({ doc }: { doc: DemoDocument }) {
  const ex = doc.extraction;
  const isInvoice = doc.kind === 'purchase-invoice' || doc.kind === 'sales-invoice';
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox="0 0 620 330" style={{ width: '100%', height: 'auto', borderRadius: 10, background: '#fff', border: '1px solid var(--border)' }} role="img" aria-label="Sample document preview">
        <rect x="0" y="0" width="620" height="330" fill="#fdfdfb" />
        <rect x="0" y="0" width="620" height="8" fill="#0b2140" />
        <text x="26" y="46" fontSize="15" fontWeight="700" fill="#0b2140">{isInvoice ? 'ABC Traders' : 'Habib Bank Limited'}</text>
        <text x="26" y="63" fontSize="9.5" fill="#6b7a93">{isInvoice ? 'Plot 9, SITE Area, Karachi · NTN 4210987-6' : 'Business Banking · Deposit Slip'}</text>
        <text x="594" y="46" textAnchor="end" fontSize="10" fill="#6b7a93">{ex.date}</text>
        <text x="594" y="62" textAnchor="end" fontSize="10" fill="#6b7a93">{ex.reference ?? 'REF: —'}</text>
        <line x1="26" y1="80" x2="594" y2="80" stroke="#d3dae8" strokeWidth="1" />
        <text x="26" y="104" fontSize="9.5" fill="#8d99ae">PARTY / ACCOUNT HOLDER</text>
        <text x="26" y="124" fontSize="13" fontWeight="600" fill="#0d1b2d">{ex.partyName}</text>
        <text x="26" y="158" fontSize="9.5" fill="#8d99ae">{isInvoice ? 'DESCRIPTION' : 'ACCOUNT TITLE'}</text>
        <text x="26" y="176" fontSize="11" fill="#35435c">{isInvoice ? 'Trading stock — assorted items' : 'ABC Trading Company · A/C •••• 6789'}</text>
        <text x="26" y="212" fontSize="9.5" fill="#8d99ae">AMOUNT</text>
        <text x="26" y="238" fontSize="22" fontWeight="700" fill="#0b2140">Rs. {ex.amount.toLocaleString('en-PK')}</text>
        <rect x="380" y="150" width="214" height="92" rx="8" fill="#f5f7fb" stroke="#e4e9f2" />
        <text x="396" y="172" fontSize="9" fill="#8d99ae">BANK STAMP / SIGNATURE</text>
        <circle cx="488" cy="206" r="26" fill="none" stroke="#9bb0d0" strokeWidth="1.4" strokeDasharray="4 3" />
        <text x="488" y="210" textAnchor="middle" fontSize="8" fill="#9bb0d0">SAMPLE</text>
        <line x1="26" y1="266" x2="594" y2="266" stroke="#e4e9f2" strokeWidth="1" />
        <text x="26" y="288" fontSize="8.5" fill="#8d99ae">Fictional document created for the AI Business Secretary demo — not a real bank slip or invoice.</text>
      </svg>
      <div style={{ position: 'absolute', top: 12, right: 12 }}>
        <span className="badge amber">DEMO SAMPLE</span>
      </div>
    </div>
  );
}
