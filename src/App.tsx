/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Download, 
  Save, 
  RotateCcw, 
  FileText, 
  CheckCircle2, 
  XCircle,
  Database,
  Calendar,
  Layers,
  Image as ImageIcon
} from 'lucide-react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { clsx, type ClassValue } from 'clsx';
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

// --- Component: Rich Text Editor ---
const RichTextEditor = ({ value, onChange, id }: { value: string; onChange: (content: string) => void; id: string }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);

  useEffect(() => {
    if (editorRef.current && !quillRef.current) {
      quillRef.current = new Quill(editorRef.current, {
        theme: 'snow',
        modules: {
          toolbar: [
            [{ header: [1, 2, false] }],
            ['bold', 'italic', 'underline', 'strike'],
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
      <div ref={editorRef} style={{ height: '200px' }} />
    </div>
  );
};

export default function App() {
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [isGenerating, setIsGenerating] = useState(false);
  const pdfTemplateRef = useRef<HTMLDivElement>(null);

  // --- Handlers ---
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

  const saveToLocalStorage = () => {
    localStorage.setItem('erp_test_notebook_data', JSON.stringify(data));
    alert('Données sauvegardées localement !');
  };

  const restoreFromLocalStorage = () => {
    const saved = localStorage.getItem('erp_test_notebook_data');
    if (saved) {
      setData(JSON.parse(saved));
      alert('Données restaurées !');
    } else {
      alert('Aucune sauvegarde trouvée.');
    }
  };

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-notebook-${data.jiraNumber || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generatePDF = async () => {
    if (!data.jiraNumber || !data.jiraName) {
      alert('Veuillez remplir au moins le numéro et le nom de la JIRA.');
      return;
    }

    setIsGenerating(true);
    
    // Give React a moment to render the hidden template
    setTimeout(async () => {
      const element = pdfTemplateRef.current;
      const opt = {
        margin: 0,
        filename: `Cahier_Tests_${data.jiraNumber}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] as const }
      };

      try {
        await html2pdf().set(opt).from(element).save();
      } catch (error) {
        console.error('PDF Generation Error:', error);
        alert('Erreur lors de la génération du PDF.');
      } finally {
        setIsGenerating(false);
      }
    }, 500);
  };

  // Helper to extract digits from JIRA number
  const jiraDigits = data.jiraNumber.replace(/\D/g, '');

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <FileText className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Cahier de Tests ERP</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={restoreFromLocalStorage}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Restaurer
            </button>
            <button 
              onClick={saveToLocalStorage}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" /> Sauvegarder
            </button>
            <button 
              onClick={generatePDF}
              disabled={isGenerating}
              className="flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Génération...' : <><Download className="w-4 h-4" /> Télécharger PDF</>}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Image Page 2</label>
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

      {/* --- HIDDEN PDF TEMPLATE --- */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <div ref={pdfTemplateRef} className="pdf-container">
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
              {/* Placeholder for icon.png - using a generic icon if not found */}
              <div className="w-48 h-48 bg-slate-100 rounded-full flex items-center justify-center border-4 border-indigo-600">
                <FileText className="w-24 h-24 text-indigo-600" />
              </div>
              <p className="mt-8 text-2xl font-bold text-slate-400 uppercase tracking-widest">Cahier de Tests</p>
            </div>

            <div className="pdf-footer">
              <div>{data.jiraNumber} / {data.jiraName}</div>
              <div className="html2pdf__page-number"></div>
            </div>
          </div>

          {/* Page 2 and following */}
          <div className="pdf-page">
            <div className="pdf-content">
              <h2 className="text-xl font-bold mb-4 border-b-2 border-slate-800 pb-2">Détails Techniques</h2>
              
              <div className="mb-8">
                <p className="font-semibold mb-2">Requête SQL de vérification :</p>
                <div className="sql-block">
                  select * from psoprdzfn where oprid='{jiraDigits || 'XXXX'}';
                </div>
              </div>

              {data.localImage && (
                <div className="mb-8">
                  <p className="font-semibold mb-2">Capture d'écran initiale :</p>
                  <img src={data.localImage} alt="Local" className="pdf-image-main" />
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-lg font-bold mb-2">Environnement de test</h3>
                <p className="bg-slate-100 p-3 rounded border border-slate-300 inline-block font-mono">
                  {data.environment}
                </p>
              </div>

              <h2 className="text-xl font-bold mt-10 mb-4 border-b-2 border-slate-800 pb-2">Déroulement des Tests</h2>
              
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
                <h2 className="text-xl font-bold mb-4 border-b-2 border-slate-800 pb-2">Conclusion du Test</h2>
                <div className={data.conclusion === 'OK' ? 'conclusion-ok' : 'conclusion-ko'}>
                  BON POUR PROD {data.conclusion}
                </div>
              </div>
            </div>

            <div className="pdf-footer">
              <div>{data.jiraNumber} / {data.jiraName}</div>
              <div className="html2pdf__page-number"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
