import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
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
  PlusCircle, Users, Activity, Clock, 
  LogOut, Stethoscope, ArrowLeft, Send, History, 
  ChevronRight, Sun, Moon, Edit2, Trash2, Search, 
  Brain, Lock, FileDown, ShieldCheck, Smartphone, 
  CheckCircle, BedDouble, Ambulance, Clipboard, Save, X
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

// --- COMPONENTES UI ULTRA PREMIUM ---

const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = "", onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white dark:bg-slate-800 rounded-[3rem] shadow-sm border border-slate-100 dark:border-slate-700/50 overflow-hidden transition-all duration-500 ${onClick ? 'cursor-pointer hover:shadow-2xl hover:scale-[1.01]' : ''} ${className}`}
  >
    {children}
  </div>
);

const Label: React.FC<{ children: React.ReactNode; required?: boolean }> = ({ children, required }) => (
  <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] mb-3 ml-2">
    {children} {required && <span className="text-red-500">*</span>}
  </label>
);

const Input: React.FC<any> = ({ label, required, ...props }) => (
  <div className="mb-6">
    <Label required={required}>{label}</Label>
    <input className="w-full px-7 py-5 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-700 rounded-[1.8rem] focus:border-blue-500 outline-none text-slate-800 dark:text-slate-100 font-bold transition-all placeholder:text-slate-300 shadow-inner" {...props} />
  </div>
);

const TextArea: React.FC<any> = ({ label, required, ...props }) => (
  <div className="mb-6">
    <Label required={required}>{label}</Label>
    <textarea className="w-full px-7 py-5 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-700 rounded-[2.5rem] focus:border-blue-500 outline-none text-slate-800 dark:text-slate-100 font-medium min-h-[140px] transition-all shadow-inner leading-relaxed" {...props} />
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
    'Alta': <CheckCircle size={12} className="mr-2" />,
    'Observação': <Activity size={12} className="mr-2" />,
    'Aguardando Vaga': <Clock size={12} className="mr-2" />,
    'Internado': <BedDouble size={12} className="mr-2" />,
    'Transferido': <Ambulance size={12} className="mr-2" />,
  };

  return (
    <span className={`inline-flex items-center px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-transparent ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {icons[status]}
      {status}
    </span>
  );
};

const SparkLine = ({ data, color }: { data: number[], color: string }) => {
  if (!data || data.length < 2) return <div className="text-[10px] opacity-40 italic font-black uppercase tracking-widest leading-none">Iniciando dados...</div>;
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

  // --- BLINDAGEM DA ARTE PREMIUM ---
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) root.classList.add('dark'); else root.classList.remove('dark');
    localStorage.setItem('medflow-theme', isDarkMode ? 'dark' : 'light');

    const styleId = 'medflow-ultra-reset-premium';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;900&display=swap');
        #root { 
          width: 100% !important; 
          max-width: 100% !important; 
          margin: 0 !important; 
          padding: 0 !important; 
          display: block !important; 
          text-align: left !important; 
        }
        body { 
          margin: 0; 
          padding: 0; 
          width: 100%; 
          min-height: 100vh; 
          overflow-x: hidden; 
          background-color: #f8fafc; 
          transition: background-color 0.4s cubic-bezier(0.4, 0, 0.2, 1); 
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }
        .dark body { background-color: #0f172a; color: #f8fafc; }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 20px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
        .animate-premium { animation: premium-fade 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
        @keyframes premium-fade { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
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
    if (view === 'form') {
      const timer = setTimeout(() => {
        localStorage.setItem('medflow-draft', JSON.stringify(formData));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [formData, view]);

  // --- SEGURANÇA PIN ---
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

  // --- FIREBASE SYNC ---
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

  // --- HANDLERS ---
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
      const log: AuditEntry = { action: 'ADMISSÃO', timestamp: new Date().toISOString(), details: 'Registo inicial do paciente criado.' };
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
    const content = `MEDFLOW - RELATÓRIO CLÍNICO\n\nPaciente: ${selectedPatient.nome}\nIdade: ${selectedPatient.idade}\nStatus: ${selectedPatient.status}\n\nAVALIAÇÃO:\n${selectedPatient.hipotese}\n\nCONDUTA:\n${selectedPatient.conduta}`;
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

  // --- BLOQUEIO ULTRA ---
  if (isLocked) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-6 animate-premium">
      <div className="bg-slate-900 p-16 rounded-[4.5rem] border border-slate-800 shadow-2xl text-center">
        <Lock size={100} className="mx-auto mb-12 text-blue-500 drop-shadow-[0_0_25px_rgba(59,130,246,0.6)]" />
        <h2 className="text-4xl font-black mb-4 tracking-tighter uppercase leading-none">Sistema Bloqueado</h2>
        <p className="text-slate-400 mb-14 max-w-[300px] mx-auto text-sm font-medium italic">Insira o código PIN para continuar o plantão.</p>
        <input 
          type="password" maxLength={4} 
          className="w-56 text-center text-7xl font-black bg-slate-800 border-4 border-slate-700 rounded-[2.5rem] p-8 focus:border-blue-500 outline-none mb-10 text-white tracking-[0.2em]" 
          autoFocus 
          onChange={(e) => { if (e.target.value === '1234') setIsLocked(false); }} 
        />
        <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.5em] leading-none">Segurança Bio-Criptográfica Ativa</p>
      </div>
    </div>
  );

  if (!user) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-700 to-indigo-950 w-full p-4">
      <Card className="w-full max-w-md p-14 text-center mx-auto shadow-2xl bg-white/95 border-0 animate-premium">
        <div className="bg-blue-600 text-white p-8 rounded-[2.5rem] w-32 h-32 flex items-center justify-center mx-auto mb-14 shadow-2xl shadow-blue-500/40"><Stethoscope size={64} /></div>
        <h1 className="text-6xl font-black text-slate-800 mb-3 tracking-tighter">MedFlow</h1>
        <p className="text-slate-500 mb-20 font-black uppercase tracking-[0.3em] text-[11px] opacity-70">Censo Médico Individual</p>
        <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="w-full bg-white border-2 border-slate-100 py-6 rounded-[3rem] flex items-center justify-center gap-5 font-black text-slate-700 hover:bg-slate-50 hover:border-blue-300 transition-all active:scale-95 shadow-sm uppercase tracking-widest text-[12px]">
           <img src="https://www.google.com/favicon.ico" alt="G" className="w-6 h-6" /> Entrar com conta Google
        </button>
        <div className="mt-16 p-8 bg-blue-50/50 rounded-[3rem] border-2 border-blue-100 text-left relative overflow-hidden">
           <div className="absolute top-0 right-0 p-6 opacity-10"><ShieldCheck size={56} className="text-blue-600"/></div>
           <p className="text-[11px] text-blue-700 font-black uppercase tracking-widest mb-3 flex items-center gap-3"><div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div> Isolamento de Dados</p>
           <p className="text-xs text-blue-600 leading-relaxed font-bold italic opacity-90">A sua lista de pacientes é estritamente privada e acessível apenas pelo seu utilizador.</p>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen w-full pb-20 bg-slate-50 dark:bg-slate-900 transition-colors duration-500 font-sans">
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-3xl shadow-sm sticky top-0 z-40 border-b border-slate-200 dark:border-slate-700">
        <div className="w-full max-w-[1600px] mx-auto px-10 py-6 flex justify-between items-center gap-8">
          <div className="flex items-center gap-5 cursor-pointer shrink-0" onClick={() => setView('list')}>
            <div className="bg-blue-600 text-white p-3 rounded-[1.2rem] shadow-xl shadow-blue-500/20"><Stethoscope size={32} /></div>
            <h1 className="font-black text-3xl tracking-tighter hidden lg:block dark:text-white uppercase leading-none mt-1">MedFlow</h1>
          </div>
          
          <div className="flex-1 max-w-2xl relative group">
            <Search className="absolute left-6 top-5 text-slate-400 group-focus-within:text-blue-500 transition-colors mt-0.5" size={24} />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Pesquisar por paciente, CID ou hipótese..." className="w-full pl-16 pr-8 py-5 bg-slate-100/50 dark:bg-slate-700/50 border-none rounded-[2rem] text-sm focus:ring-4 focus:ring-blue-500/10 outline-none dark:text-white transition-all font-black placeholder:text-slate-400" />
          </div>

          <div className="flex items-center gap-5 shrink-0">
             <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-4.5 rounded-[1.5rem] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all shadow-sm"><Sun size={24} className="hidden dark:block"/><Moon size={24} className="dark:hidden"/></button>
             {view === 'list' && <button onClick={() => setView('form')} className="bg-blue-600 text-white px-10 py-4.5 rounded-[1.8rem] text-[12px] font-black flex items-center gap-4 hover:bg-blue-700 shadow-2xl shadow-blue-500/30 active:scale-95 transition-all"><PlusCircle size={22} /> <span className="hidden sm:inline uppercase tracking-widest leading-none mt-0.5">ADMITIR PACIENTE</span></button>}
             {view !== 'list' && <button onClick={goBackToList} className="p-4.5 rounded-[1.5rem] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all shadow-sm"><ArrowLeft size={24} /></button>}
             <button onClick={() => signOut(auth)} className="p-4.5 text-slate-400 hover:text-red-500 transition-colors"><LogOut size={26} /></button>
          </div>
        </div>
      </header>

      {notification && (
        <div className={`fixed top-12 right-12 z-50 px-12 py-6 rounded-[3rem] shadow-2xl text-white text-[12px] font-black uppercase tracking-[0.25em] animate-premium ${notification.type === 'error' ? 'bg-red-500 shadow-red-500/30' : 'bg-emerald-600 shadow-emerald-500/40'}`}>{notification.message}</div>
      )}

      {/* MODAL STATUS PREMIUM */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 rounded-[5rem] w-full max-w-lg shadow-[0_60px_120px_-20px_rgba(0,0,0,0.6)] p-16 animate-premium border-2 border-slate-100 dark:border-slate-700">
            <h3 className="font-black text-5xl mb-12 flex items-center gap-6 dark:text-white tracking-tighter uppercase leading-none"><Edit2 size={44} className="text-blue-500" /> Status</h3>
            <div className="space-y-10">
               <select className="w-full p-8 rounded-[2.5rem] border-4 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-black dark:text-white focus:border-blue-500 outline-none transition-all shadow-inner text-xl cursor-pointer" value={statusUpdateValue} onChange={(e) => setStatusUpdateValue(e.target.value)}>
                  <option value="Alta">Alta Médica</option><option value="Observação">Em Observação</option><option value="Aguardando Vaga">Aguardando Vaga</option><option value="Internado">Internado</option><option value="Transferido">Transferido</option>
               </select>
               <textarea className="w-full p-8 rounded-[3rem] border-4 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 min-h-[200px] dark:text-white font-bold placeholder-slate-400 focus:border-blue-500 outline-none transition-all shadow-inner leading-relaxed text-lg" placeholder="Justificativa da alteração..." value={statusJustification} onChange={(e) => setStatusJustification(e.target.value)} />
               <div className="flex gap-6 pt-6"><button onClick={() => setIsStatusModalOpen(false)} className="flex-1 py-7 font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest text-[12px]">CANCELAR</button><button onClick={handleUpdateStatus} disabled={!statusJustification.trim() || loading} className="flex-[2] bg-blue-600 text-white rounded-[2.5rem] font-black shadow-2xl shadow-blue-500/40 active:scale-95 disabled:opacity-50 uppercase tracking-[0.2em] text-[12px]">ATUALIZAR REGISTO</button></div>
            </div>
          </div>
        </div>
      )}

      <main className="w-full max-w-[1600px] mx-auto px-10 py-16">
        {view === 'list' && (
          <div className="space-y-16 animate-premium">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-12">
              <div><h2 className="text-7xl font-black tracking-tighter dark:text-white leading-[0.8] uppercase">Censo</h2><p className="text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.4em] text-[11px] mt-6 opacity-80 italic flex items-center gap-3"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div> {user.email}</p></div>
              <button onClick={() => setShowDischarged(!showDischarged)} className={`px-12 py-5.5 rounded-[2.5rem] text-[11px] font-black uppercase tracking-[0.3em] transition-all border-4 shadow-sm ${showDischarged ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white border-transparent' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-100 dark:border-slate-700 hover:border-blue-300 hover:bg-slate-50'}`}>{showDischarged ? 'OCULTAR ALTAS' : 'EXIBIR ALTAS'}</button>
            </div>

            {filteredPatients.length === 0 ? (
              <div className="py-56 text-center bg-white dark:bg-slate-800 rounded-[6rem] border-8 border-dashed border-slate-50 dark:border-slate-700/50 shadow-inner flex flex-col items-center"><ShieldCheck size={120} className="mb-12 text-slate-100 dark:text-slate-700"/><p className="text-slate-400 font-black text-4xl tracking-tight uppercase opacity-50">Censo vazio.</p><button onClick={() => setView('form')} className="text-blue-600 font-black mt-10 hover:underline tracking-[0.4em] uppercase text-sm">ADMITIR AGORA</button></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-14">
                {filteredPatients.map(p => (
                  <Card key={p.id} onClick={() => openPatientDetails(p)} className="p-14 group relative animate-premium">
                    <div className="flex justify-between items-start mb-12">
                       <div><h3 className="font-black text-5xl text-slate-800 dark:text-white leading-[0.9] mb-4 group-hover:text-blue-600 transition-all uppercase tracking-tighter">{p.nome}</h3><div className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.35em] font-bold">{p.idade} ANOS • {p.createdAt ? new Date(p.createdAt.seconds * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'AGORA'}</div></div>
                       <Badge status={p.status} />
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-8 rounded-[3rem] border-2 border-slate-100 dark:border-slate-700/50 mb-14 min-h-[120px] flex items-center shadow-inner group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/10 transition-all">
                       <p className="font-bold text-[16px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed italic opacity-80 group-hover:opacity-100 transition-opacity tracking-tight">“{p.hipotese}”</p>
                    </div>
                    <div className="flex items-center justify-between border-t-4 border-slate-50 dark:border-slate-700/50 pt-12">
                        <div className="flex gap-12"><div className="text-center"><span className="text-[10px] font-black text-slate-300 dark:text-slate-500 block uppercase mb-3 tracking-[0.25em]">PA</span><span className="text-2xl font-black dark:text-slate-200 leading-none">{p.pa}</span></div><div className="text-center"><span className="text-[10px] font-black text-slate-300 dark:text-slate-500 block uppercase mb-3 tracking-[0.25em]">SAT</span><span className="text-2xl font-black dark:text-slate-200 leading-none">{p.sat}%</span></div></div>
                        {p.vitalsHistory && p.vitalsHistory.length > 1 && <SparkLine data={p.vitalsHistory.map(v => parseFloat(v.fc))} color="#3b82f6" />}
                        <div className="bg-slate-100 dark:bg-slate-700 p-5 rounded-[2rem] group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xl group-hover:rotate-12 active:scale-90"><ChevronRight size={32} /></div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'form' && (
          <form onSubmit={handleSubmit} className="max-w-[1400px] mx-auto space-y-16 animate-premium">
             <div className="flex flex-col md:flex-row justify-between md:items-end bg-white dark:bg-slate-800 p-16 rounded-[6rem] shadow-sm border border-slate-100 dark:border-slate-700 gap-10">
               <div><h2 className="text-8xl font-black tracking-tighter dark:text-white leading-[0.7] mb-6 uppercase">Admissão</h2><p className="text-slate-400 font-black uppercase text-[12px] tracking-[0.5em] opacity-70 italic flex items-center gap-4 leading-none"><div className="w-3 h-3 bg-blue-500 rounded-full animate-ping"></div> Protocolo Médico de Plantão</p></div>
               <div className="flex gap-6">
                 <button type="button" onClick={suggestCid} disabled={isCidLoading} title="Inteligência Artificial CID-10" className="p-8 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-[3rem] hover:scale-110 transition-all shadow-2xl shadow-purple-500/20 active:rotate-12"><Brain size={44} /></button>
                 <button type="button" onClick={() => { if(confirm("Apagar rascunho atual?")) { setFormData(initialFormState); localStorage.removeItem('medflow-draft'); } }} className="p-8 bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded-[3rem] hover:scale-110 transition-all shadow-2xl shadow-red-500/20 active:-rotate-12"><Trash2 size={44} /></button>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-16 pb-24">
               <div className="lg:col-span-2 space-y-16">
                  <Card className="p-16 shadow-[0_50px_100px_-25px_rgba(0,0,0,0.08)] border-0 rounded-[5rem]"><h3 className="font-black text-5xl mb-16 flex items-center gap-6 text-blue-600 dark:text-blue-400 tracking-tighter uppercase leading-none"><Users size={50}/> Identidade</h3>
                    <Input label="Nome Completo" value={formData.nome} onChange={(e:any) => setFormData({...formData, nome: e.target.value})} required placeholder="Paciente..." />
                    <div className="grid grid-cols-2 gap-12">
                       <Input label="Idade" type="number" value={formData.idade} onChange={(e:any) => setFormData({...formData, idade: e.target.value})} />
                       <Input label="PA (mmHg)" value={formData.pa} onChange={(e:any) => setFormData({...formData, pa: e.target.value})} placeholder="120/80" />
                    </div>
                    <div className="grid grid-cols-3 gap-8 pt-8">
                       <Input label="FC (bpm)" value={formData.fc} onChange={(e:any) => setFormData({...formData, fc: e.target.value})} className="text-center font-black text-2xl" />
                       <Input label="Sat (%)" value={formData.sat} onChange={(e:any) => setFormData({...formData, sat: e.target.value})} className="text-center font-black text-2xl" />
                       <Input label="T (ºC)" value={formData.temp} onChange={(e:any) => setFormData({...formData, temp: e.target.value})} className="text-center font-black text-2xl" />
                    </div>
                  </Card>
                  <Card className="p-16 bg-slate-900 dark:bg-black text-white border-0 shadow-[0_60px_120px_-30px_rgba(15,23,42,0.6)] rounded-[6rem]">
                     <h3 className="font-black text-5xl text-blue-400 mb-16 border-b-4 border-slate-800 pb-10 flex items-center gap-6 tracking-tighter uppercase leading-none"><Stethoscope size={50}/> Avaliação</h3>
                     <TextArea label="Hipótese Diagnóstica" value={formData.hipotese} onChange={(e:any) => setFormData({...formData, hipotese: e.target.value})} placeholder="Quadro clínico..." required />
                     <TextArea label="Conduta Proposta" value={formData.conduta} onChange={(e:any) => setFormData({...formData, conduta: e.target.value})} placeholder="Plano terapêutico..." required />
                     <div className="mb-16 ml-2"><Label>Destino Inicial</Label><select className="w-full p-8 rounded-[2.5rem] bg-slate-950 border-4 border-slate-800 text-white font-black outline-none focus:border-blue-500 transition-all cursor-pointer shadow-inner text-xl leading-none" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                        <option value="Alta">Alta Médica</option><option value="Observação">Observação</option><option value="Aguardando Vaga">Vaga</option><option value="Internado">Internado</option>
                     </select></div>
                     <button type="submit" disabled={loading} className="w-full bg-blue-600 py-10 rounded-[3.5rem] font-black text-3xl hover:bg-blue-500 shadow-2xl shadow-blue-500/50 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-[0.25em]"><Save size={40} className="inline mr-5 mb-2"/> FINALIZAR</button>
                  </Card>
               </div>
               <div className="lg:col-span-3 space-y-16">
                  <Card className="p-16 shadow-[0_50px_100px_-25px_rgba(0,0,0,0.08)] h-full border-0 rounded-[6rem]">
                     <h3 className="font-black text-5xl mb-16 flex items-center gap-6 text-emerald-600 dark:text-emerald-400 tracking-tighter uppercase leading-none"><Activity size={50}/> Anamnese</h3>
                     <TextArea label="Queixa Principal" rows={2} value={formData.queixa} onChange={(e:any) => setFormData({...formData, queixa: e.target.value})} />
                     <TextArea label="História Médica Atual (HDA)" rows={8} value={formData.hda} onChange={(e:any) => setFormData({...formData, hda: e.target.value})} />
                     <TextArea label="Exame Físico Sistematizado" rows={14} value={formData.exameFisico} onChange={(e:any) => setFormData({...formData, exameFisico: e.target.value})} />
                  </Card>
               </div>
            </div>
          </form>
        )}

        {view === 'details' && selectedPatient && (
          <div className="space-y-16 animate-premium max-w-[1500px] mx-auto pb-40">
            <div className="bg-white dark:bg-slate-800 p-16 rounded-[7rem] shadow-[0_80px_160px_-40px_rgba(0,0,0,0.2)] border border-slate-100 dark:border-slate-700 flex flex-col md:flex-row justify-between md:items-center gap-14 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-8 h-full bg-blue-600 shadow-[15px_0_50px_rgba(37,99,235,0.4)]"></div>
               <div className="flex-1">
                  <div className="flex items-center gap-10 mb-10">
                    <h2 className="text-8xl font-black tracking-tighter text-slate-900 dark:text-white leading-[0.75] uppercase">{selectedPatient.nome}</h2>
                    <div className="flex gap-5 shrink-0">
                       <button onClick={() => { setStatusUpdateValue(selectedPatient.status); setStatusJustification(''); setIsStatusModalOpen(true); }} className="p-6 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full border-4 border-blue-100 dark:border-blue-800 shadow-sm transition-all hover:scale-125 active:rotate-45"><Edit2 size={40} /></button>
                       <button onClick={async () => { if(confirm("Deseja apagar definitivamente?")) { await deleteDoc(doc(db, 'artifacts', appId, 'users', user!.uid, 'consultas_medicas', selectedPatient.id)); goBackToList(); } }} className="p-6 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full border-4 border-red-100 dark:border-red-800 shadow-sm transition-all hover:scale-125 active:-rotate-45"><Trash2 size={40} /></button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-12 text-lg font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.5em] italic opacity-80 leading-none">
                    <span className="bg-slate-100 dark:bg-slate-700 px-10 py-4 rounded-[2.5rem] text-slate-800 dark:text-slate-200 shadow-inner">{selectedPatient.idade} ANOS</span>
                    <Badge status={selectedPatient.status} />
                    <span className="flex items-center gap-5 bg-slate-50 dark:bg-slate-800/50 px-10 py-4 rounded-[2.5rem]"><Clock size={30} className="text-blue-500"/> ADMISSÃO: {new Date(selectedPatient.createdAt?.seconds! * 1000).toLocaleString('pt-PT', {day:'2-digit', month:'long', hour:'2-digit', minute:'2-digit'})}</span>
                  </div>
               </div>
               <div className="flex gap-8">
                  <button onClick={suggestCid} disabled={isCidLoading} className="bg-purple-600 text-white px-14 py-8 rounded-[3.5rem] font-black text-[13px] hover:bg-purple-700 flex items-center gap-6 shadow-2xl shadow-purple-500/40 active:scale-95 disabled:opacity-50 transition-all uppercase tracking-[0.25em]"><Brain size={40} /> IA CLINICA</button>
                  <button onClick={exportPdf} className="bg-slate-900 text-white px-14 py-8 rounded-[3.5rem] font-black text-[13px] hover:bg-black flex items-center gap-6 shadow-2xl shadow-black/40 active:scale-95 transition-all uppercase tracking-[0.25em]"><FileDown size={40} /> EXPORTAR</button>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-16">
               <div className="lg:col-span-2 space-y-16">
                  <Card className="p-16 shadow-2xl border-0 rounded-[6rem]">
                    <h3 className="font-black text-6xl mb-16 flex items-center gap-8 text-red-500 dark:text-red-400 tracking-tighter uppercase leading-none"><Activity size={64}/> Monitor</h3>
                    <div className="grid grid-cols-2 gap-12 mb-16">
                       <div className="bg-slate-50 dark:bg-slate-900 p-12 rounded-[4.5rem] border border-slate-100 dark:border-slate-700 shadow-inner flex flex-col items-center"><span className="text-[12px] font-black text-slate-400 dark:text-slate-500 block mb-6 uppercase tracking-[0.4em]">PA</span><span className="font-black text-6xl dark:text-slate-100 tracking-tighter leading-none">{selectedPatient.pa || '-'}</span></div>
                       <div className="bg-slate-50 dark:bg-slate-900 p-12 rounded-[4.5rem] border border-slate-100 dark:border-slate-700 shadow-inner flex flex-col items-center"><span className="text-[12px] font-black text-slate-400 dark:text-slate-500 block mb-6 uppercase tracking-[0.4em]">SAT</span><span className="font-black text-6xl dark:text-slate-100 tracking-tighter leading-none">{selectedPatient.sat || '-'}%</span></div>
                    </div>
                    {selectedPatient.vitalsHistory && selectedPatient.vitalsHistory.length > 1 && (
                      <div className="space-y-12 animate-premium">
                         <div className="p-12 bg-blue-50/50 dark:bg-blue-900/10 rounded-[5rem] flex justify-between items-center border border-blue-50 dark:border-blue-900/20 shadow-sm transition-all hover:bg-blue-50 dark:hover:bg-blue-900/20"><span className="text-[12px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.4em] font-black leading-none">Tendência FC</span><SparkLine data={selectedPatient.vitalsHistory.map(v => parseFloat(v.fc))} color="#3b82f6" /></div>
                         <div className="p-12 bg-red-50/50 dark:bg-red-900/10 rounded-[5rem] flex justify-between items-center border border-red-50 dark:border-red-900/20 shadow-sm transition-all hover:bg-red-50 dark:hover:bg-red-900/20"><span className="text-[12px] font-black text-red-600 dark:text-red-400 uppercase tracking-[0.4em] font-black leading-none">Tendência Temp</span><SparkLine data={selectedPatient.vitalsHistory.map(v => parseFloat(v.temp))} color="#ef4444" /></div>
                      </div>
                    )}
                  </Card>
                  
                  <div className="bg-slate-950 p-16 rounded-[6rem] shadow-2xl border border-slate-900 text-slate-400 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-10 opacity-[0.03]"><ShieldCheck size={240} /></div>
                    <h3 className="font-black text-4xl mb-16 flex items-center gap-7 text-blue-500 uppercase tracking-[0.5em] leading-none"><ShieldCheck size={48}/> Auditoria</h3>
                    <div className="space-y-12 max-h-[600px] overflow-y-auto pr-10 custom-scrollbar">
                       {selectedPatient.auditLog?.map((log, i) => (
                         <div key={i} className="text-[14px] font-bold border-l-8 border-slate-800 pl-10 py-4 leading-relaxed hover:bg-slate-900/50 transition-all rounded-r-[3rem] animate-premium"><span className="text-slate-600 font-mono block mb-3 text-[12px] tracking-normal">{new Date(log.timestamp).toLocaleString('pt-PT')}</span><span className="text-blue-400 font-black mr-4 uppercase tracking-tighter leading-none">{log.action}:</span> {log.details}</div>
                       ))}
                    </div>
                  </div>
               </div>

               <div className="lg:col-span-3 space-y-16">
                  <Card className="p-16 shadow-2xl border-0 rounded-[7rem]">
                     <h3 className="font-black text-7xl mb-16 border-b-8 border-slate-50 dark:border-slate-700/50 pb-12 flex items-center gap-10 text-purple-600 dark:text-purple-400 tracking-tighter uppercase leading-none"><History size={72}/> Diário</h3>
                     <div className="space-y-16">
                        {(!selectedPatient.evolutions || selectedPatient.evolutions.length === 0) && (
                          <div className="py-32 text-center bg-slate-50 dark:bg-slate-900/50 rounded-[6rem] border-8 border-dashed border-slate-100 dark:border-slate-800"><p className="text-slate-400 font-black italic uppercase text-lg tracking-[0.5em] opacity-40 leading-relaxed">Prontuário aguardando evoluções.</p></div>
                        )}
                        {selectedPatient.evolutions?.map((ev, i) => (
                          <div key={i} className={`p-14 rounded-[5rem] border shadow-sm transition-all animate-premium ${ev.text.includes('STATUS') ? 'bg-blue-50/50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/50 shadow-blue-500/10' : 'bg-white dark:bg-slate-900/50 border-slate-100 dark:border-slate-700'}`}>
                             <div className="text-[13px] font-black text-slate-300 dark:text-slate-500 mb-8 uppercase tracking-[0.4em] flex justify-between items-center border-b dark:border-slate-800 pb-6 leading-none"><span>{new Date(ev.createdAt).toLocaleString('pt-PT')}</span><span className="opacity-80 font-black px-7 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-2xl shadow-inner border border-slate-100 dark:border-slate-700 leading-none">DR. {user.email?.split('@')[0].toUpperCase()}</span></div>
                             <p className="text-slate-700 dark:text-slate-200 font-bold leading-[1.8] whitespace-pre-wrap text-xl italic opacity-90 tracking-tight">“{ev.text}”</p>
                          </div>
                        ))}
                        {selectedPatient.status !== 'Alta' && (
                          <div className="flex flex-col gap-10 pt-20">
                             <div className="relative group">
                               <textarea value={evolutionText} onChange={(e) => setEvolutionText(e.target.value)} placeholder="Registe aqui a evolução clínica, novos dados vitais ou conduta atualizada para auditoria hospitalar..." className="w-full p-16 rounded-[6rem] border-8 border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 focus:border-blue-100 dark:focus:border-blue-900/50 focus:bg-white dark:focus:bg-slate-900 outline-none min-h-[400px] dark:text-white font-black shadow-inner placeholder:opacity-20 text-2xl leading-relaxed transition-all duration-700" />
                               <div className="absolute bottom-16 right-16 flex gap-8">
                                  <button onClick={() => {
                                    const vitals = `PA: ${selectedPatient.pa} | FC: ${selectedPatient.fc} | Sat: ${selectedPatient.sat}% | T: ${selectedPatient.temp}ºC`;
                                    const text = `PACIENTE: ${selectedPatient.nome}\nHD: ${selectedPatient.hipotese}\nCONDUTA: ${selectedPatient.conduta}\nVITAI: ${vitals}\nSTATUS: ${selectedPatient.status}`;
                                    const el = document.createElement('textarea'); el.value = text; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
                                    showNotification("Resumo copiado!");
                                  }} title="Copiar resumo clínico" className="p-10 rounded-[3rem] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all shadow-xl active:scale-90"><Clipboard size={48} /></button>
                                  <button onClick={async () => {
                                    if(!evolutionText.trim()) return;
                                    setLoading(true);
                                    try {
                                      const pRef = doc(db, 'artifacts', appId, 'users', user.uid, 'consultas_medicas', selectedPatient.id);
                                      await updateDoc(pRef, { evolutions: arrayUnion({ text: evolutionText, createdAt: new Date().toISOString(), createdBy: user.uid }) });
                                      setEvolutionText(''); showNotification("Evolução salva!");
                                    } catch(e) { showNotification("Erro ao guardar", "error"); } finally { setLoading(false); }
                                  }} disabled={loading || !evolutionText.trim()} className="bg-blue-600 text-white p-10 rounded-[3.5rem] hover:bg-blue-700 shadow-2xl shadow-blue-500/50 active:scale-90 transition-all disabled:opacity-50"><Send size={56} /></button>
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
