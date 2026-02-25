/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Printer, 
  Save, 
  RotateCcw, 
  FileText, 
  CheckCircle2, 
  XCircle,
  Database,
  Calendar,
  Layers,
  Image as ImageIcon,
  Eye,
  X,
  Copy,
  Check
} from 'lucide-react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import BlotFormatter from 'quill-blot-formatter';
import { clsx, type ClassValue } from 'clsx';

Quill.register('modules/blotFormatter', BlotFormatter);
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TestStep {
  id: string;
  title: string;
  content: string;
}

interface AppData {
  jiraNumber: string;
  jiraName: string;
  type: 'TMD' | 'TMA';
  date: string;
  environment: 'FRECMCOR' | 'FPOST';
  conclusion: 'OK' | 'KO';
  localImage: string | null;
  steps: TestStep[];
}

const INITIAL_DATA: AppData = {
  jiraNumber: '',
  jiraName: '',
  type: 'TMD',
  date: new Date().toISOString().split('T')[0],
  environment: 'FRECMCOR',
  conclusion: 'OK',
  localImage: null,
  steps: [{ id: crypto.randomUUID(), title: 'Étape 1', content: '' }]
};

const COLORS = [
  '#000000', '#444444', '#666666', '#999999',
  '#cccccc', '#eeeeee', '#f3f6f4', '#ffffff',
  '#ff0000', '#ff9900', '#ffff00', '#00ff00',
  '#00ffff', '#0000ff', '#9900ff', '#ff00ff'
];

// --- Component: Rich Text Editor ---
const RichTextEditor = ({ value, onChange, id }: { value: string; onChange: (content: string) => void; id: string }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);

  useEffect(() => {
    if (editorRef.current && !quillRef.current) {
      quillRef.current = new Quill(editorRef.current, {
        theme: 'snow',
        modules: {
          blotFormatter: {},
          toolbar: [
            [{ header: [1, 2, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ color: COLORS }, { background: COLORS }],
            ['blockquote', 'code-block'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['link', 'image'],
            ['clean']
          ]
        }
      });

      quillRef.current.on('text-change', () => {
        const html = quillRef.current?.root.innerHTML || '';
        onChange(html);
      });
    }

    if (quillRef.current && quillRef.current.root.innerHTML !== value) {
      // Only update if content is different to avoid cursor jumps
      // But be careful with images/complex HTML
      if (value === '') {
        quillRef.current.root.innerHTML = '';
      } else if (quillRef.current.root.innerHTML === '<p><br></p>' && value === '') {
        // ignore
      } else if (quillRef.current.root.innerHTML !== value) {
        // We only set it if it's not a user-triggered change (e.g. restore)
        // For simplicity in this demo, we'll just set it if it's empty or significantly different
      }
    }
  }, []);

  // Handle value updates from outside (like Restore)
  useEffect(() => {
    if (quillRef.current && value !== quillRef.current.root.innerHTML) {
      quillRef.current.root.innerHTML = value;
    }
  }, [value]);

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div ref={editorRef} style={{ minHeight: '200px' }} />
    </div>
  );
};

export default function App() {
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const printTemplateRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to extract digits from JIRA number
  const jiraDigits = data.jiraNumber.replace(/\D/g, '');
  const sqlQuery = `select * from ps_s1_scripts_tbl where s1_script_name like '%${jiraDigits || 'XXXX'}J%';`;
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setData(prev => ({ ...prev, localImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const addStep = () => {
    setData(prev => ({
      ...prev,
      steps: [...prev.steps, { id: crypto.randomUUID(), title: `Étape ${prev.steps.length + 1}`, content: '' }]
    }));
  };

  const removeStep = (id: string) => {
    setData(prev => ({
      ...prev,
      steps: prev.steps.filter(step => step.id !== id)
    }));
  };

  const updateStep = (id: string, updates: Partial<TestStep>) => {
    setData(prev => ({
      ...prev,
      steps: prev.steps.map(step => step.id === id ? { ...step, ...updates } : step)
    }));
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && typeof json === 'object') {
          setData(json);
          alert('Données restaurées avec succès !');
        }
      } catch (error) {
        alert('Erreur lors de la lecture du fichier de sauvegarde. Assurez-vous qu\'il s\'agit d\'un fichier JSON valide.');
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be loaded again if needed
    e.target.value = '';
  };

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cahier-recette-${data.jiraNumber || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!data.jiraNumber || !data.jiraName) {
      alert('Veuillez remplir au moins le numéro et le nom de la JIRA.');
      return;
    }
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20 print:bg-white print:pb-0">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <FileText className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Cahier de Tests ERP</h1>
          </div>
          <div className="flex items-center gap-3">
            <input 
              type="file" 
              accept=".json" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Restaurer
            </button>
            <button 
              onClick={downloadJSON}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" /> Sauvegarder
            </button>
            <button 
              onClick={() => setIsPreviewOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Eye className="w-4 h-4" /> Aperçu
            </button>
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md hover:shadow-lg transition-all"
            >
              <Printer className="w-4 h-4" /> Imprimer
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8 print:hidden">
        {/* Left Column: Main Info */}
        <div className="lg:col-span-1 space-y-6">
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Layers className="w-4 h-4" /> Informations JIRA
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Numéro JIRA</label>
                <input 
                  type="text" 
                  name="jiraNumber"
                  value={data.jiraNumber}
                  onChange={handleInputChange}
                  placeholder="ex: ERP-1234"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom de la JIRA</label>
                <input 
                  type="text" 
                  name="jiraName"
                  value={data.jiraName}
                  onChange={handleInputChange}
                  placeholder="Description courte"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select 
                    name="type"
                    value={data.type}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
                  >
                    <option value="TMD">TMD</option>
                    <option value="TMA">TMA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input 
                    type="date" 
                    name="date"
                    value={data.date}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* SQL Query Auto-gen Zone */}
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Requête SQL Developer</label>
                <div className="relative group">
                  <div className="w-full bg-slate-900 text-indigo-300 p-3 rounded-xl font-mono text-[10px] sm:text-xs break-all pr-10 border border-slate-800 shadow-inner">
                    {sqlQuery}
                  </div>
                  <button 
                    onClick={() => copyToClipboard(sqlQuery)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all shadow-sm"
                    title="Copier la requête"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 italic">Générée automatiquement à partir du numéro JIRA</p>
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Database className="w-4 h-4" /> Configuration Test
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Environnement</label>
                <select 
                  name="environment"
                  value={data.environment}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
                >
                  <option value="FRECMCOR">FRECMCOR</option>
                  <option value="FPOST">FPOST</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Conclusion</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setData(prev => ({ ...prev, conclusion: 'OK' }))}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2 rounded-xl border transition-all font-medium",
                      data.conclusion === 'OK' 
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/20" 
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <CheckCircle2 className="w-4 h-4" /> Bon pour Prod OK
                  </button>
                  <button 
                    onClick={() => setData(prev => ({ ...prev, conclusion: 'KO' }))}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2 rounded-xl border transition-all font-medium",
                      data.conclusion === 'KO' 
                        ? "bg-red-50 border-red-500 text-red-700 ring-2 ring-red-500/20" 
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <XCircle className="w-4 h-4" /> Bon pour Prod KO
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Capture exécution requête</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-xl hover:border-indigo-400 transition-colors cursor-pointer relative group">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="space-y-1 text-center">
                    {data.localImage ? (
                      <div className="relative inline-block">
                        <img src={data.localImage} alt="Preview" className="h-24 w-auto rounded-lg shadow-sm border border-slate-200" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity">
                          <ImageIcon className="text-white w-6 h-6" />
                        </div>
                      </div>
                    ) : (
                      <>
                        <ImageIcon className="mx-auto h-12 w-12 text-slate-400" />
                        <div className="flex text-sm text-slate-600">
                          <span className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500">Charger une image</span>
                        </div>
                        <p className="text-xs text-slate-500">PNG, JPG jusqu'à 10MB</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Steps Editor */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" /> Étapes du Test
            </h2>
            <button 
              onClick={addStep}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-xl shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" /> Ajouter une étape
            </button>
          </div>

          <div className="space-y-6">
            {data.steps.map((step, index) => (
              <div key={step.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden group transition-all hover:shadow-md">
                <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <span className="bg-slate-200 text-slate-600 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </span>
                    <input 
                      type="text"
                      value={step.title}
                      onChange={(e) => updateStep(step.id, { title: e.target.value })}
                      className="bg-transparent border-none focus:ring-0 font-semibold text-slate-700 p-0 w-full"
                      placeholder="Titre de l'étape"
                    />
                  </div>
                  <button 
                    onClick={() => removeStep(step.id)}
                    className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6">
                  <RichTextEditor 
                    id={step.id}
                    value={step.content}
                    onChange={(content) => updateStep(step.id, { content })}
                  />
                </div>
              </div>
            ))}

            {data.steps.length === 0 && (
              <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                <FileText className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                <p className="text-slate-500 font-medium">Aucune étape ajoutée</p>
                <button 
                  onClick={addStep}
                  className="mt-4 text-indigo-600 font-semibold hover:underline"
                >
                  Ajouter votre première étape
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* --- PREVIEW MODAL --- */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 print:hidden">
          <div className="bg-slate-100 w-full max-w-7xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Eye className="w-5 h-5 text-indigo-600" /> Aperçu avant impression (Format A4)
              </h3>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all"
                >
                  <Printer className="w-4 h-4" /> Imprimer maintenant
                </button>
                <button 
                  onClick={() => setIsPreviewOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8 bg-slate-200/50">
              <div className="print-container shadow-2xl relative">
                <PrintContent data={data} jiraDigits={jiraDigits} />
                <div className="pdf-footer-fixed">
                  <div>{data.jiraNumber} / {data.jiraName}</div>
                  <div>Cahier de recette</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- HIDDEN PRINT TEMPLATE --- */}
      <div className="hidden print:block">
        <div ref={printTemplateRef} className="print-container relative">
          <PrintContent data={data} jiraDigits={jiraDigits} />
          <div className="pdf-footer-fixed">
            <div>{data.jiraNumber} / {data.jiraName}</div>
            <div>Cahier de recette</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub-component for the actual document content ---
function PrintContent({ data, jiraDigits }: { data: AppData; jiraDigits: string }) {
  return (
    <>
      {/* Page 1: Page de Garde */}
      <div className="pdf-page">
        <div className="pdf-header-band">
          <div className="pdf-header-left">
            {data.jiraNumber || 'JIRA-XXX'}
          </div>
          <div className="pdf-header-right">
            {data.jiraName || 'NOM DE LA JIRA'}
          </div>
        </div>
        
        <div className="pdf-sub-header">
          [{data.type}] - [{new Date(data.date).toLocaleDateString('fr-FR')}]
        </div>

        <div className="flex flex-col items-center justify-center" style={{ height: '200mm' }}>
          <img 
            src="/icon.png" 
            alt="Logo Cahier de Tests" 
            className="w-[576px] h-[576px] object-contain"
            onError={(e) => {
              // Fallback visuel si l'image n'est pas trouvée
              e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%234f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>';
            }}
          />
          <p className="mt-8 text-2xl font-bold text-slate-400 uppercase tracking-widest">Cahier de Recette</p>
        </div>
      </div>

      {/* Page 2 and following */}
      <table className="w-full">
        <thead>
          <tr>
            <td>
              <div style={{ height: '15mm' }}></div>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div className="pdf-content">
                <h2 className="text-xl font-bold mb-4 border-b-2 border-red-900 text-red-900 pb-2">Détails Techniques</h2>
                
                <div className="mb-8">
                  <p className="font-semibold mb-2">Requête SQL de vérification :</p>
                  <div className="sql-block">
                    select * from ps_s1_scripts_tbl where s1_script_name like '%{jiraDigits || 'XXXX'}J%';
                  </div>
                </div>

                {data.localImage && (
                  <div className="mb-8">
                    <p className="font-semibold mb-2">Exécution SQL :</p>
                    <img src={data.localImage} alt="Local" className="pdf-image-main" />
                  </div>
                )}

                <div className="mb-8">
                  <h3 className="text-lg font-bold mb-2">Environnement de test</h3>
                  <p className="bg-slate-100 p-3 rounded border border-slate-300 inline-block font-mono">
                    {data.environment}
                  </p>
                </div>

                <h2 className="text-xl font-bold mt-10 mb-4 border-b-2 border-red-900 text-red-900 pb-2">Déroulement des Tests</h2>
                
                {data.steps.map((step, idx) => (
                  <div key={step.id} className="mb-8" style={{ pageBreakInside: 'avoid' }}>
                    <div className="step-title">
                      Étape {idx + 1} : {step.title}
                    </div>
                    <div 
                      className="ql-editor" 
                      style={{ padding: 0, minHeight: 'auto' }}
                      dangerouslySetInnerHTML={{ __html: step.content }} 
                    />
                  </div>
                ))}

                <div className="mt-12" style={{ pageBreakInside: 'avoid' }}>
                  <h2 className="text-xl font-bold mb-4 border-b-2 border-red-900 text-red-900 pb-2">Conclusion du Test</h2>
                  <div className={data.conclusion === 'OK' ? 'conclusion-ok' : 'conclusion-ko'}>
                    BON POUR PROD {data.conclusion}
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>
              <div style={{ height: '15mm' }}></div>
            </td>
          </tr>
        </tfoot>
      </table>
    </>
  );
}
