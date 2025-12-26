import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
// Removido import './App.css' para evitar erro de resolução.
// Os estilos de arte premium serão injetados via JavaScript no useEffect.
import { 
  getAuth, 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  type User 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  deleteDoc,
  arrayUnion,
  Timestamp
} from 'firebase/firestore';
import { 
  PlusCircle, Users, Activity, Clock, FileText, 
  LogOut, Stethoscope, ArrowLeft, Send, History, 
  ChevronRight, Sun, Moon, Edit2, Trash2, Search, 
  Brain, Lock, FileDown, ShieldCheck, Smartphone,
  CheckCircle, BedDouble, Ambulance, Clipboard, Save, Filter, X, Share
} from 'lucide-react';

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBmYfkgmYMHxDpx-8KlYXz0ZNFWP5B0Axo",
  authDomain: "plantao-zero.firebaseapp.com",
  projectId: "plantao-zero",
  storageBucket: "plantao-zero.firebasestorage.app",
  messagingSenderId: "96539843160",
  appId: "1:96539843160:web:6c54cc238ba057b578882d",
  measurementId: "G-RDKXGCZ7WE"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "plantao-zero-app";
const apiKey = ""; // Gemini API Key

// --- TIPAGENS ---
interface VitalRecord {
  pa: string;
  fc: string;
  sat: string;
  temp: string;
  timestamp: string;
}

interface AuditEntry {
  action: string;
  timestamp: string;
  details: string;
}

interface Evolution {
  text: string;
  createdAt: string;
  createdBy: string;
}

interface Patient {
  id: string;
  nome: string;
  idade: string;
  queixa: string;
  hda: string;
  exameFisico: string;
  hipotese: string;
  conduta: string;
  status: string;
  pa: string;
  fc: string;
  sat: string;
  temp: string;
  vitalsHistory?: VitalRecord[];
  auditLog?: AuditEntry[];
  userId: string;
  createdAt?: Timestamp;
  active: boolean;
  evolutions?: Evolution[];
}

// --- FUNÇÃO GEMINI API ---
const callGemini = async (prompt: string, retryCount = 0): Promise<string> => {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: "Você é um assistente médico especialista em CID-10. Retorne apenas o código e o nome da doença de forma curta." }] }
      })
    });
    if (!response.ok && retryCount < 3) return callGemini(prompt, retryCount + 1);
    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || "Não disponível.";
  } catch (e) { return "Erro na IA."; }
};

// --- COMPONENTES UI ULTRA ---

const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = "", onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700/50 overflow-hidden transition-all ${onClick ? 'cursor-pointer hover:shadow-2xl hover:scale-[1.01]' : ''} ${className}`}
  >
    {children}
  </div>
);

const Label: React.FC<{ children: React.ReactNode; required?: boolean }> = ({ children, required }) => (
  <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">
    {children} {required && <span className="text-red-500">*</span>}
  </label>
);

const Input: React.FC<any> = ({ label, required, ...props }) => (
  <div className="mb-4">
    <Label required={required}>{label}</Label>
    <input className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-blue-500 outline-none text-slate-800 dark:text-slate-100 font-bold transition-all placeholder:text-slate-300" {...props} />
  </div>
);

const TextArea: React.FC<any> = ({ label, required, ...props }) => (
  <div className="mb-4">
    <Label required={required}>{label}</Label>
    <textarea className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-700 rounded-[2rem] focus:border-blue-500 outline-none text-slate-800 dark:text-slate-100 font-medium min-h-[120px] transition-all" {...props} />
  </div>
);

const Badge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    'Alta': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    'Observação': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    'Aguardando Vaga': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    'Internado': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    'Transferido': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  };
  
  const icons: Record<string, React.ReactNode> = {
    'Alta': <CheckCircle size={12} className="mr-1" />,
    'Observação': <Activity size={12} className="mr-1" />,
    'Aguardando Vaga': <Clock size={12} className="mr-1" />,
    'Internado': <BedDouble size={12} className="mr-1" />,
    'Transferido': <Ambulance size={12} className="mr-1" />,
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border border-transparent ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {icons[status]}
      {status}
    </span>
  );
};

const SparkLine = ({ data, color }: { data: number[], color: string }) => {
  if (!data || data.length < 2) return <div className="text-[10px] opacity-40 italic font-black uppercase tracking-widest leading-none">Iniciando...</div>;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = (max - min) || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - ((v - min) / range) * 30}`).join(' ');
  return (
    <svg width="100" height="30" className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={points} />
      <circle cx="100" cy={30 - ((data[data.length-1] - min) / range) * 30} r="3" fill={color} />
    </svg>
  );
};

// --- COMPONENTE PRINCIPAL ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'list' | 'form' | 'details'>('list');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('medflow-theme') === 'dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [showDischarged, setShowDischarged] = useState(false);
  
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusUpdateValue, setStatusUpdateValue] = useState('');
  const [statusJustification, setStatusJustification] = useState('');
  const [isCidLoading, setIsCidLoading] = useState(false);

  const initialFormState = {
    nome: '', idade: '', queixa: '', hda: '', pa: '', fc: '', sat: '', temp: '',
    exameFisico: 'BEG, LOTE, Mocorada, Hidratada, Eupneica, Afebril.\nACV: RCR em 2T, BNF, sem sopros.\nAR: MV+, sem RA.\nABD: Flácido, indolor, RHA+.\nMMII: Sem edemas, panturrilhas livres.',
    hipotese: '', conduta: '', status: 'Alta'
  };
  const [formData, setFormData] = useState(initialFormState);
  const [evolutionText, setEvolutionText] = useState('');

  // --- CONTROLO DE TEMA E INJEÇÃO DE ESTILOS CRÍTICOS ---
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) root.classList.add('dark'); else root.classList.remove('dark');
    localStorage.setItem('medflow-theme', isDarkMode ? 'dark' : 'light');

    const styleId = 'medflow-ultra-reset';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        #root { width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; display: block !important; text-align: left !important; }
        body { margin: 0; padding: 0; width: 100%; min-height: 100vh; overflow-x: hidden; background-color: #f8fafc; transition: background-color 0.3s; font-family: 'Inter', system-ui, sans-serif; }
        .dark body { background-color: #0f172a; color: #f8fafc; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
        .animate-premium { transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
      `;
      document.head.appendChild(style);
    }
  }, [isDarkMode]);

  // --- AUTO-SAVE ---
  useEffect(() => {
    if (view === 'form') {
      const saved = localStorage.getItem('medflow-draft');
      if (saved) setFormData(JSON.parse(saved));
    }
  }, [view]);

  useEffect(() => {
    if (view === 'form') localStorage.setItem('medflow-draft', JSON.stringify(formData));
  }, [formData, view]);

  // --- BLOQUEIO POR INATIVIDADE ---
  useEffect(() => {
    let timeout: any;
    const resetTimer = () => {
      clearTimeout(timeout);
      if (!isLocked && user) timeout = setTimeout(() => setIsLocked(true), 300000); 
    };
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    return () => { window.removeEventListener('mousemove', resetTimer); window.removeEventListener('keydown', resetTimer); };
  }, [isLocked, user]);

  // --- FIREBASE DATA ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const privateCol = collection(db, 'artifacts', appId, 'users', user.uid, 'consultas_medicas');
    return onSnapshot(privateCol, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Patient[];
      setPatients(data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      if (selectedPatient) {
        const up = data.find(p => p.id === selectedPatient.id);
        if (up) setSelectedPatient(up);
      }
    }, (error) => console.error("Firestore Error:", error));
  }, [user, selectedPatient?.id]);

  // --- AÇÕES ---
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleUpdateStatus = async () => {
    if (!selectedPatient || !statusUpdateValue || !statusJustification.trim() || !user) return;
    setLoading(true);
    try {
      const patientRef = doc(db, 'artifacts', appId, 'users', user.uid, 'consultas_medicas', selectedPatient.id);
      const log: AuditEntry = { action: 'MUDANÇA_STATUS', timestamp: new Date().toISOString(), details: `Para: ${statusUpdateValue}. Motivo: ${statusJustification}` };
      await updateDoc(patientRef, {
        status: statusUpdateValue,
        active: statusUpdateValue !== 'Alta',
        evolutions: arrayUnion({ text: `🔄 MUDANÇA DE STATUS: ${statusUpdateValue}\nMOTIVO: ${statusJustification}`, createdAt: new Date().toISOString(), createdBy: user.uid }),
        auditLog: arrayUnion(log)
      });
      showNotification("Status atualizado!");
      setIsStatusModalOpen(false);
    } catch (e) { showNotification("Erro ao atualizar", "error"); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const vital: VitalRecord = { pa: formData.pa, fc: formData.fc, sat: formData.sat, temp: formData.temp, timestamp: new Date().toISOString() };
      const log: AuditEntry = { action: 'ADMISSÃO', timestamp: new Date().toISOString(), details: 'Registo inicial criado.' };
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'consultas_medicas'), {
        ...formData,
        userId: user.uid,
        createdAt: serverTimestamp(),
        active: formData.status !== 'Alta',
        vitalsHistory: [vital],
        auditLog: [log],
        evolutions: []
      });
      showNotification("Admissão concluída!");
      localStorage.removeItem('medflow-draft');
      setFormData(initialFormState);
      setView('list');
    } catch (e) { showNotification("Erro ao salvar", "error"); }
    finally { setLoading(false); }
  };

  const suggestCid = async () => {
    const hip = view === 'form' ? formData.hipotese : selectedPatient?.hipotese;
    if (!hip) return;
    setIsCidLoading(true);
    const result = await callGemini(`Sugira o código CID-10 para a hipótese: "${hip}". Retorne apenas o código e o nome.`);
    if (view === 'form') setFormData({...formData, hipotese: `${formData.hipotese} (Sugestão CID: ${result})`});
    else if (selectedPatient) {
       const pRef = doc(db, 'artifacts', appId, 'users', user!.uid, 'consultas_medicas', selectedPatient.id);
       await updateDoc(pRef, { hipotese: `${selectedPatient.hipotese} (Sugestão CID: ${result})` });
    }
    setIsCidLoading(false);
  };

  const exportPdf = () => {
    if (!selectedPatient) return;
    const content = `MEDFLOW - RELATÓRIO CLÍNICO\n\nPaciente: ${selectedPatient.nome}\nIdade: ${selectedPatient.idade}\nStatus: ${selectedPatient.status}\n\nHD: ${selectedPatient.hipotese}\nCONDUTA: ${selectedPatient.conduta}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `medflow_${selectedPatient.nome.replace(/\s/g, '_')}.txt`; a.click();
    showNotification("Relatório gerado!");
  };

  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      const matchSearch = p.nome.toLowerCase().includes(searchQuery.toLowerCase()) || p.hipotese.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = showDischarged || p.status !== 'Alta';
      return matchSearch && matchStatus;
    });
  }, [patients, searchQuery, showDischarged]);

  const goBackToList = () => { setSelectedPatient(null); setView('list'); };

  const openPatientDetails = (patient: Patient) => { setSelectedPatient(patient); setView('details'); };

  // --- BLOQUEIO ---
  if (isLocked) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-6 animate-premium">
      <div className="bg-slate-900 p-12 rounded-[3.5rem] border border-slate-800 shadow-2xl text-center">
        <Lock size={80} className="mx-auto mb-10 text-blue-500" />
        <h2 className="text-3xl font-black mb-4 tracking-tighter uppercase">Plantão Bloqueado</h2>
        <p className="text-slate-400 mb-10 max-w-[250px] mx-auto text-sm font-medium italic">Insira o código de segurança para retomar.</p>
        <input 
          type="password" maxLength={4} 
          className="w-48 text-center text-6xl font-black bg-slate-800 border-2 border-slate-700 rounded-[2rem] p-6 focus:border-blue-500 outline-none mb-6 text-white tracking-widest" 
          autoFocus 
          onChange={(e) => { if (e.target.value === '1234') setIsLocked(false); }} 
        />
        <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.4em]">Segurança Bio-Analítica</p>
      </div>
    </div>
  );

  if (!user) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-700 to-indigo-950 w-full p-4">
      <Card className="w-full max-w-md p-12 text-center mx-auto shadow-2xl bg-white/95 border-0">
        <div className="bg-blue-600 text-white p-6 rounded-[2rem] w-24 h-24 flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-blue-500/30"><Stethoscope size={48} /></div>
        <h1 className="text-5xl font-black text-slate-800 mb-2 tracking-tighter">MedFlow</h1>
        <p className="text-slate-500 mb-14 font-bold text-lg opacity-80 uppercase tracking-widest text-xs">Gestão Profissional de Plantão</p>
        <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="w-full bg-white border-2 border-slate-100 py-5 rounded-[2rem] flex items-center justify-center gap-4 font-black text-slate-700 hover:bg-slate-50 hover:border-blue-300 transition-all active:scale-95 shadow-sm uppercase tracking-widest text-[10px]">
           <img src="https://www.google.com/favicon.ico" alt="G" className="w-5 h-5" /> Entrar com conta Google
        </button>
        <div className="mt-12 p-6 bg-blue-50 rounded-[2rem] border border-blue-100 text-left relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-10"><ShieldCheck size={40} className="text-blue-600"/></div>
           <p className="text-[10px] text-blue-700 font-black uppercase tracking-widest mb-2 flex items-center gap-1">Privacidade Criptografada</p>
           <p className="text-xs text-blue-600 leading-relaxed font-bold italic">Os dados são isolados por médico. Apenas você visualiza os seus pacientes.</p>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen w-full pb-20 bg-slate-50 dark:bg-slate-900 transition-colors duration-500">
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl shadow-sm sticky top-0 z-40 border-b border-slate-200 dark:border-slate-700">
        <div className="w-full max-w-7xl mx-auto px-6 py-5 flex justify-between items-center gap-4">
          <div className="flex items-center gap-4 cursor-pointer shrink-0" onClick={() => setView('list')}>
            <div className="bg-blue-600 text-white p-2.5 rounded-2xl shadow-xl shadow-blue-500/20"><Stethoscope size={24} /></div>
            <h1 className="font-black text-2xl tracking-tighter hidden md:block dark:text-white uppercase">MedFlow</h1>
          </div>
          
          <div className="flex-1 max-w-xl relative group">
            <Search className="absolute left-4 top-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Pesquisar por nome, CID ou diagnóstico..." className="w-full pl-12 pr-6 py-4 bg-slate-100 dark:bg-slate-700 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white transition-all font-bold" />
          </div>

          <div className="flex items-center gap-3 shrink-0">
             <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-200 transition-all shadow-sm"><Sun size={20} className="hidden dark:block"/><Moon size={20} className="dark:hidden"/></button>
             {view === 'list' && <button onClick={() => setView('form')} className="bg-blue-600 text-white px-7 py-3.5 rounded-2xl text-xs font-black flex items-center gap-2 hover:bg-blue-700 shadow-xl shadow-blue-500/20 active:scale-95 transition-all"><PlusCircle size={20} /> <span className="hidden sm:inline uppercase tracking-widest">ADMITIR</span></button>}
             {view !== 'list' && <button onClick={goBackToList} className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 transition-all shadow-sm"><ArrowLeft size={20} /></button>}
             <button onClick={() => signOut(auth)} className="p-3.5 text-slate-400 hover:text-red-500 transition-colors ml-1"><LogOut size={22} /></button>
          </div>
        </div>
      </header>

      {notification && (
        <div className={`fixed top-8 right-8 z-50 px-8 py-5 rounded-[2rem] shadow-2xl text-white text-xs font-black uppercase tracking-widest animate-premium ${notification.type === 'error' ? 'bg-red-500' : 'bg-emerald-600 shadow-emerald-500/20'}`}>{notification.message}</div>
      )}

      {/* MODAL STATUS ULTRA */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-[3.5rem] w-full max-w-md shadow-2xl p-10 border border-slate-100 dark:border-slate-700">
            <h3 className="font-black text-3xl mb-8 flex items-center gap-4 dark:text-white tracking-tighter uppercase"><Edit2 size={30} className="text-blue-500" /> Status</h3>
            <div className="space-y-6">
               <select className="w-full p-6 rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-black dark:text-white focus:border-blue-500 outline-none transition-all" value={statusUpdateValue} onChange={(e) => setStatusUpdateValue(e.target.value)}>
                  <option value="Alta">Alta Médica</option><option value="Observação">Em Observação</option><option value="Aguardando Vaga">Aguardando Vaga</option><option value="Internado">Internado</option><option value="Transferido">Transferido</option>
               </select>
               <textarea className="w-full p-6 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 min-h-[140px] dark:text-white font-bold placeholder-slate-400 focus:border-blue-500 outline-none transition-all shadow-inner" placeholder="Justificativa da alteração..." value={statusJustification} onChange={(e) => setStatusJustification(e.target.value)} />
               <div className="flex gap-4 pt-4"><button onClick={() => setIsStatusModalOpen(false)} className="flex-1 py-5 font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest text-[10px]">CANCELAR</button><button onClick={handleUpdateStatus} disabled={!statusJustification.trim() || loading} className="flex-1 bg-blue-600 text-white rounded-[2rem] font-black shadow-2xl shadow-blue-500/20 active:scale-95 disabled:opacity-50 uppercase tracking-widest text-[10px]">CONFIRMAR</button></div>
            </div>
          </div>
        </div>
      )}

      <main className="w-full max-w-7xl mx-auto px-6 py-12">
        {view === 'list' && (
          <div className="space-y-12">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-8">
              <div><h2 className="text-5xl font-black tracking-tighter dark:text-white leading-tight uppercase">Censo Privado</h2><p className="text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.3em] text-[10px] mt-2 opacity-70 italic">{user.email}</p></div>
              <button onClick={() => setShowDischarged(!showDischarged)} className={`px-8 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all border-2 shadow-sm ${showDischarged ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white border-transparent' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-100 dark:border-slate-700 hover:border-blue-200'}`}>{showDischarged ? 'OCULTAR ALTAS' : 'MOSTRAR ALTAS'}</button>
            </div>

            {filteredPatients.length === 0 ? (
              <div className="py-40 text-center bg-white dark:bg-slate-800 rounded-[4rem] border-4 border-dashed border-slate-50 dark:border-slate-700 shadow-inner flex flex-col items-center"><ShieldCheck size={80} className="mb-8 text-slate-100 dark:text-slate-700"/><p className="text-slate-400 font-black text-2xl tracking-tight">Sem pacientes registados no seu censo.</p><button onClick={() => setView('form')} className="text-blue-600 font-black mt-6 hover:underline tracking-[0.3em] uppercase text-xs">ADMITIR NOVO PACIENTE</button></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {filteredPatients.map(p => (
                  <Card key={p.id} onClick={() => openPatientDetails(p)} className="p-10 group relative">
                    <div className="flex justify-between items-start mb-8">
                       <div><h3 className="font-black text-3xl text-slate-800 dark:text-white leading-[1.1] mb-3 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{p.nome}</h3><div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em]">{p.idade} ANOS • {p.createdAt ? new Date(p.createdAt.seconds * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'AGORA'}</div></div>
                       <Badge status={p.status} />
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-700/50 mb-10 min-h-[100px] flex items-center shadow-inner">
                       <p className="font-bold text-[13px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed italic opacity-80">“{p.hipotese}”</p>
                    </div>
                    <div className="flex items-center justify-between border-t-2 border-slate-50 dark:border-slate-700/50 pt-8">
                        <div className="flex gap-8"><div className="text-center"><span className="text-[8px] font-black text-slate-300 dark:text-slate-500 block uppercase mb-1 tracking-widest">PA</span><span className="text-base font-black dark:text-slate-200">{p.pa}</span></div><div className="text-center"><span className="text-[8px] font-black text-slate-300 dark:text-slate-500 block uppercase mb-1 tracking-widest">SAT</span><span className="text-base font-black dark:text-slate-200">{p.sat}%</span></div></div>
                        {p.vitalsHistory && p.vitalsHistory.length > 1 && <SparkLine data={p.vitalsHistory.map(v => parseFloat(v.fc))} color="#3b82f6" />}
                        <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm"><ChevronRight size={24} /></div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'form' && (
          <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-12">
             <div className="flex flex-col md:flex-row justify-between md:items-end bg-white dark:bg-slate-800 p-12 rounded-[4rem] shadow-sm border border-slate-100 dark:border-slate-700 gap-6">
               <div><h2 className="text-6xl font-black tracking-tighter dark:text-white leading-none mb-4 uppercase">Admissão</h2><p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.3em] opacity-70 italic">Protocolo de Registo de Prontuário</p></div>
               <div className="flex gap-4">
                 <button type="button" onClick={suggestCid} disabled={isCidLoading} title="Sugerir CID com IA" className="p-6 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-3xl hover:scale-110 transition-all shadow-xl shadow-purple-500/10"><Brain size={32} /></button>
                 <button type="button" onClick={() => { if(confirm("Deseja apagar o rascunho?")) { setFormData(initialFormState); localStorage.removeItem('medflow-draft'); } }} className="p-6 bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded-3xl hover:scale-110 transition-all shadow-xl shadow-red-500/10"><Trash2 size={32} /></button>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
               <div className="lg:col-span-2 space-y-12">
                  <Card className="p-12 shadow-2xl border-0"><h3 className="font-black text-3xl mb-12 flex items-center gap-4 text-blue-600 dark:text-blue-400 tracking-tighter uppercase"><Users size={32}/> Identidade</h3>
                    <Input label="Nome do Paciente" value={formData.nome} onChange={(e:any) => setFormData({...formData, nome: e.target.value})} required placeholder="Ex: João da Silva" />
                    <div className="grid grid-cols-2 gap-8">
                       <Input label="Idade" type="number" value={formData.idade} onChange={(e:any) => setFormData({...formData, idade: e.target.value})} />
                       <Input label="PA (mmHg)" value={formData.pa} onChange={(e:any) => setFormData({...formData, pa: e.target.value})} placeholder="120/80" />
                    </div>
                    <div className="grid grid-cols-3 gap-5 pt-4">
                       <Input label="FC (bpm)" value={formData.fc} onChange={(e:any) => setFormData({...formData, fc: e.target.value})} className="text-center font-black" />
                       <Input label="Sat (%)" value={formData.sat} onChange={(e:any) => setFormData({...formData, sat: e.target.value})} className="text-center font-black" />
                       <Input label="T (ºC)" value={formData.temp} onChange={(e:any) => setFormData({...formData, temp: e.target.value})} className="text-center font-black" />
                    </div>
                  </Card>
                  <Card className="p-12 bg-slate-900 dark:bg-black text-white border-0 shadow-2xl rounded-[4rem]">
                     <h3 className="font-black text-3xl text-blue-400 mb-12 border-b border-slate-800 pb-6 flex items-center gap-4 tracking-tighter uppercase"><Stethoscope size={32}/> Diagnóstico</h3>
                     <TextArea label="Hipótese Diagnóstica" value={formData.hipotese} onChange={(e:any) => setFormData({...formData, hipotese: e.target.value})} placeholder="Descreva o quadro..." required />
                     <TextArea label="Conduta Inicial" value={formData.conduta} onChange={(e:any) => setFormData({...formData, conduta: e.target.value})} placeholder="Plano terapêutico..." required />
                     <div className="mb-12 ml-1"><Label>Destino</Label><select className="w-full p-6 rounded-[2rem] bg-slate-950 border-2 border-slate-800 text-white font-black outline-none focus:border-blue-500 transition-all cursor-pointer" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                        <option value="Alta">Alta Médica</option><option value="Observação">Observação</option><option value="Aguardando Vaga">Vaga</option><option value="Internado">Internado</option>
                     </select></div>
                     <button type="submit" disabled={loading} className="w-full bg-blue-600 py-7 rounded-[2.5rem] font-black text-2xl hover:bg-blue-500 shadow-2xl shadow-blue-500/40 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest"><Save size={28} className="inline mr-3 mb-1"/> FINALIZAR REGISTO</button>
                  </Card>
               </div>
               <div className="lg:col-span-3 space-y-12">
                  <Card className="p-12 shadow-2xl h-full border-0 rounded-[4rem]">
                     <h3 className="font-black text-3xl mb-12 flex items-center gap-4 text-emerald-600 dark:text-emerald-400 tracking-tighter uppercase"><Activity size={32}/> Exame e História</h3>
                     <TextArea label="Queixa Principal" rows={2} value={formData.queixa} onChange={(e:any) => setFormData({...formData, queixa: e.target.value})} />
                     <TextArea label="História (HDA)" rows={5} value={formData.hda} onChange={(e:any) => setFormData({...formData, hda: e.target.value})} />
                     <TextArea label="Exame Físico" rows={10} value={formData.exameFisico} onChange={(e:any) => setFormData({...formData, exameFisico: e.target.value})} />
                  </Card>
               </div>
            </div>
          </form>
        )}

        {view === 'details' && selectedPatient && (
          <div className="space-y-12 animate-premium max-w-7xl mx-auto pb-20">
            <div className="bg-white dark:bg-slate-800 p-12 rounded-[5rem] shadow-2xl border border-slate-100 dark:border-slate-700 flex flex-col md:flex-row justify-between md:items-center gap-10 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-5 h-full bg-blue-600 shadow-[8px_0_30px_rgba(37,99,235,0.3)]"></div>
               <div className="flex-1">
                  <div className="flex items-center gap-6 mb-5">
                    <h2 className="text-6xl font-black tracking-tighter text-slate-900 dark:text-white leading-[0.9] uppercase">{selectedPatient.nome}</h2>
                    <div className="flex gap-3">
                       <button onClick={() => { setStatusUpdateValue(selectedPatient.status); setStatusJustification(''); setIsStatusModalOpen(true); }} className="p-4 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full border-2 border-blue-100 dark:border-blue-800 shadow-sm transition-all hover:scale-110 active:rotate-12"><Edit2 size={28} /></button>
                       <button onClick={async () => { if(confirm("Deseja apagar este prontuário?")) { await deleteDoc(doc(db, 'artifacts', appId, 'users', user!.uid, 'consultas_medicas', selectedPatient.id)); goBackToList(); } }} className="p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full border-2 border-red-100 dark:border-red-800 shadow-sm transition-all hover:scale-110 active:-rotate-12"><Trash2 size={28} /></button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-8 text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] italic opacity-80">
                    <span className="bg-slate-100 dark:bg-slate-700 px-6 py-2.5 rounded-[1.5rem] text-slate-800 dark:text-slate-200 shadow-inner">{selectedPatient.idade} ANOS</span>
                    <Badge status={selectedPatient.status} />
                    <span className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 px-6 py-2.5 rounded-[1.5rem]"><Clock size={20} className="text-blue-500"/> ADMISSÃO: {new Date(selectedPatient.createdAt?.seconds! * 1000).toLocaleString('pt-PT', {day:'2-digit', month:'long', hour:'2-digit', minute:'2-digit'})}</span>
                  </div>
               </div>
               <div className="flex gap-5">
                  <button onClick={suggestCid} disabled={isCidLoading} className="bg-purple-600 text-white px-10 py-6 rounded-[2.5rem] font-black text-xs hover:bg-purple-700 flex items-center gap-4 shadow-2xl shadow-purple-500/30 active:scale-95 transition-all uppercase tracking-widest"><Brain size={26} /> INTELIGÊNCIA IA</button>
                  <button onClick={exportPdf} className="bg-slate-900 text-white px-10 py-6 rounded-[2.5rem] font-black text-xs hover:bg-black flex items-center gap-4 shadow-2xl shadow-black/30 active:scale-95 transition-all uppercase tracking-widest"><FileDown size={26} /> PDF</button>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
               <div className="lg:col-span-2 space-y-12">
                  <Card className="p-12 shadow-2xl border-0 rounded-[4rem]">
                    <h3 className="font-black text-4xl mb-12 flex items-center gap-4 text-red-500 dark:text-red-400 tracking-tighter uppercase"><Activity size={40}/> Sinais Vitais</h3>
                    <div className="grid grid-cols-2 gap-8 mb-12">
                       <div className="bg-slate-50 dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-700 shadow-inner flex flex-col items-center"><span className="text-[10px] font-black text-slate-400 dark:text-slate-500 block mb-3 uppercase tracking-widest">PA</span><span className="font-black text-4xl dark:text-slate-100">{selectedPatient.pa || '-'}</span></div>
                       <div className="bg-slate-50 dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-700 shadow-inner flex flex-col items-center"><span className="text-[10px] font-black text-slate-400 dark:text-slate-500 block mb-3 uppercase tracking-widest">SatO2</span><span className="font-black text-4xl dark:text-slate-100">{selectedPatient.sat || '-'}%</span></div>
                    </div>
                    {selectedPatient.vitalsHistory && selectedPatient.vitalsHistory.length > 1 && (
                      <div className="space-y-8 animate-premium">
                         <div className="p-8 bg-blue-50/50 dark:bg-blue-900/10 rounded-[3rem] flex justify-between items-center border border-blue-50 dark:border-blue-900/20 shadow-sm"><span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest leading-none">Histórico FC</span><SparkLine data={selectedPatient.vitalsHistory.map(v => parseFloat(v.fc))} color="#3b82f6" /></div>
                         <div className="p-8 bg-red-50/50 dark:bg-red-900/10 rounded-[3rem] flex justify-between items-center border border-red-50 dark:border-red-900/20 shadow-sm"><span className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest leading-none">Histórico Temp</span><SparkLine data={selectedPatient.vitalsHistory.map(v => parseFloat(v.temp))} color="#ef4444" /></div>
                      </div>
                    )}
                  </Card>
                  
                  <div className="bg-slate-950 p-12 rounded-[4rem] shadow-2xl border border-slate-900 text-slate-400 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-5"><ShieldCheck size={120} /></div>
                    <h3 className="font-black text-2xl mb-10 flex items-center gap-4 text-blue-500 uppercase tracking-[0.3em]"><ShieldCheck size={28}/> Auditoria Médica</h3>
                    <div className="space-y-8 max-h-[400px] overflow-y-auto pr-6 custom-scrollbar">
                       {selectedPatient.auditLog?.map((log, i) => (
                         <div key={i} className="text-[12px] font-bold border-l-4 border-slate-800 pl-6 py-2 leading-relaxed hover:bg-slate-900 transition-all rounded-r-2xl"><span className="text-slate-600 font-mono block mb-2 text-[10px] tracking-normal">{new Date(log.timestamp).toLocaleString('pt-PT')}</span><span className="text-blue-400/80 font-black mr-2 uppercase tracking-tighter">{log.action}:</span> {log.details}</div>
                       ))}
                    </div>
                  </div>
               </div>

               <div className="lg:col-span-3 space-y-12">
                  <Card className="p-12 shadow-2xl border-0 rounded-[4rem]">
                     <h3 className="font-black text-4xl mb-12 border-b-4 border-slate-50 dark:border-slate-700/50 pb-8 flex items-center gap-5 text-purple-600 dark:text-purple-400 tracking-tighter uppercase"><History size={44}/> Diário Clínico</h3>
                     <div className="space-y-10">
                        {(!selectedPatient.evolutions || selectedPatient.evolutions.length === 0) && (
                          <div className="py-20 text-center bg-slate-50 dark:bg-slate-900/50 rounded-[4rem] border-4 border-dashed border-slate-100 dark:border-slate-800"><p className="text-slate-400 font-black italic uppercase text-xs tracking-widest opacity-60 leading-relaxed">Sem evoluções registadas para este paciente.</p></div>
                        )}
                        {selectedPatient.evolutions?.map((ev, i) => (
                          <div key={i} className={`p-10 rounded-[3rem] border shadow-sm transition-all ${ev.text.includes('STATUS') ? 'bg-blue-50/40 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/50' : 'bg-white dark:bg-slate-900/50 border-slate-100 dark:border-slate-700'}`}>
                             <div className="text-[11px] font-black text-slate-300 dark:text-slate-500 mb-5 uppercase tracking-[0.25em] flex justify-between items-center border-b dark:border-slate-800 pb-4"><span>{new Date(ev.createdAt).toLocaleString('pt-PT')}</span><span className="opacity-70 font-black px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg shadow-inner">DR. {user.email?.split('@')[0].toUpperCase()}</span></div>
                             <p className="text-slate-700 dark:text-slate-200 font-bold leading-relaxed whitespace-pre-wrap text-base italic opacity-90 leading-relaxed">“{ev.text}”</p>
                          </div>
                        ))}
                        {selectedPatient.status !== 'Alta' && (
                          <div className="flex flex-col gap-6 pt-12">
                             <div className="relative group">
                               <textarea value={evolutionText} onChange={(e) => setEvolutionText(e.target.value)} placeholder="Registe a evolução clínica, novos dados ou conduta..." className="w-full p-12 rounded-[4rem] border-4 border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 focus:border-blue-100 dark:focus:border-blue-900/50 focus:bg-white dark:focus:bg-slate-900 outline-none min-h-[250px] dark:text-white font-bold shadow-inner placeholder-slate-300 text-lg leading-relaxed transition-all" />
                               <div className="absolute bottom-10 right-10 flex gap-4">
                                  <button onClick={() => {
                                    const text = `PACIENTE: ${selectedPatient.nome}\nHD: ${selectedPatient.hipotese}\nCONDUTA: ${selectedPatient.conduta}`;
                                    const el = document.createElement('textarea'); el.value = text; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
                                    showNotification("Copiado com sucesso!");
                                  }} title="Copiar sumário" className="p-7 rounded-[2.5rem] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all shadow-xl active:scale-90"><Clipboard size={36} /></button>
                                  <button onClick={async () => {
                                    if(!evolutionText.trim()) return;
                                    setLoading(true);
                                    try {
                                      const pRef = doc(db, 'artifacts', appId, 'users', user.uid, 'consultas_medicas', selectedPatient.id);
                                      await updateDoc(pRef, { evolutions: arrayUnion({ text: evolutionText, createdAt: new Date().toISOString(), createdBy: user.uid }) });
                                      setEvolutionText(''); showNotification("Evolução guardada!");
                                    } catch(e) { showNotification("Erro ao guardar", "error"); } finally { setLoading(false); }
                                  }} disabled={loading || !evolutionText.trim()} className="bg-blue-600 text-white p-7 rounded-[2.5rem] hover:bg-blue-700 shadow-2xl shadow-blue-500/30 active:scale-90 transition-all disabled:opacity-50"><Send size={40} /></button>
                               </div>
                             </div>
                          </div>
                        )}
                     </div>
                  </Card>
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
