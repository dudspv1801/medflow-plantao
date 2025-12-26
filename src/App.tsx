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
  CheckCircle, BedDouble, Ambulance, Filter, Clipboard
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
const apiKey = ""; // Gemini API Key (providenciada pelo ambiente)

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

// --- COMPONENTES UI ---

const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = "", onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-all ${onClick ? 'cursor-pointer hover:shadow-md' : ''} ${className}`}
  >
    {children}
  </div>
);

const Label: React.FC<{ children: React.ReactNode; required?: boolean }> = ({ children, required }) => (
  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
    {children} {required && <span className="text-red-500">*</span>}
  </label>
);

const Input: React.FC<any> = ({ label, required, ...props }) => (
  <div className="mb-4">
    <Label required={required}>{label}</Label>
    <input className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100 font-medium" {...props} />
  </div>
);

const TextArea: React.FC<any> = ({ label, required, ...props }) => (
  <div className="mb-4">
    <Label required={required}>{label}</Label>
    <textarea className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100 min-h-[100px]" {...props} />
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
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter border border-transparent ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {icons[status]}
      {status}
    </span>
  );
};

// --- GRÁFICO TENDÊNCIAS ---
const SparkLine = ({ data, color }: { data: number[], color: string }) => {
  if (!data || data.length < 2) return <div className="text-[10px] opacity-40 italic">Iniciando dados...</div>;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = (max - min) || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - ((v - min) / range) * 30}`).join(' ');
  return (
    <svg width="100" height="30" className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
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
  
  // Modais
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

  // --- CONTROLO DE TEMA E INJEÇÃO DE CSS ---
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) root.classList.add('dark'); else root.classList.remove('dark');
    localStorage.setItem('medflow-theme', isDarkMode ? 'dark' : 'light');

    const styleId = 'medflow-critical-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        #root { width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; display: block !important; text-align: left !important; }
        body { margin: 0; padding: 0; width: 100%; min-height: 100vh; display: block; overflow-x: hidden; background-color: #f8fafc; transition: background-color 0.3s; }
        .dark body { background-color: #0f172a; color: #f8fafc; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
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
      showNotification("Admissão guardada!");
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
    const content = `MEDFLOW - RELATÓRIO\n\nPaciente: ${selectedPatient.nome}\nIdade: ${selectedPatient.idade}\nStatus: ${selectedPatient.status}\n\nAVALIAÇÃO:\n${selectedPatient.hipotese}\n\nCONDUTA:\n${selectedPatient.conduta}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medflow_${selectedPatient.nome.replace(/\s/g, '_')}.txt`;
    a.click();
    showNotification("Relatório gerado!");
  };

  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      const matchSearch = p.nome.toLowerCase().includes(searchQuery.toLowerCase()) || p.hipotese.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = showDischarged || p.status !== 'Alta';
      return matchSearch && matchStatus;
    });
  }, [patients, searchQuery, showDischarged]);

  const goBackToList = () => {
    setSelectedPatient(null);
    setEvolutionText('');
    setView('list');
  };

  const openPatientDetails = (patient: Patient) => {
    setSelectedPatient(patient);
    setView('details');
  };

  // --- BLOQUEIO ---
  if (isLocked) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-6">
      <div className="bg-slate-900 p-12 rounded-[3rem] border border-slate-800 shadow-2xl text-center animate-in zoom-in duration-300">
        <Lock size={64} className="mx-auto mb-8 text-blue-500" />
        <h2 className="text-2xl font-black mb-4">Sessão Bloqueada</h2>
        <input type="password" maxLength={4} className="w-40 text-center text-4xl font-black bg-slate-800 border-2 border-slate-700 rounded-3xl p-4 focus:border-blue-500 outline-none mb-4 text-white" autoFocus onChange={(e) => { if (e.target.value === '1234') setIsLocked(false); }} />
        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">PIN de Segurança Padrão: 1234</p>
      </div>
    </div>
  );

  if (!user) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-700 to-indigo-950 w-full p-4">
      <Card className="w-full max-w-md p-10 text-center mx-auto shadow-2xl bg-white/95 border-0 animate-in fade-in duration-500">
        <div className="bg-blue-600 text-white p-5 rounded-[2rem] w-20 h-20 flex items-center justify-center mx-auto mb-8 shadow-xl"><Stethoscope size={44} /></div>
        <h1 className="text-4xl font-black text-slate-800 mb-2 tracking-tighter">MedFlow</h1>
        <p className="text-slate-500 mb-12 font-medium leading-tight">Gestão Privada de Plantão Médico</p>
        <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="w-full bg-white border-2 border-slate-100 py-4 rounded-2xl flex items-center justify-center gap-4 font-black text-slate-700 hover:bg-slate-50 hover:border-blue-200 transition-all active:scale-95 shadow-sm"><img src="https://www.google.com/favicon.ico" alt="G" className="w-6 h-6" />Entrar com conta Google</button>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen w-full pb-20 bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <header className="bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-40 border-b border-slate-200 dark:border-slate-700">
        <div className="w-full max-w-7xl mx-auto px-4 py-3 flex justify-between items-center gap-4">
          <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => setView('list')}>
            <div className="bg-blue-600 text-white p-2 rounded-xl"><Stethoscope size={20} /></div>
            <h1 className="font-black text-xl tracking-tighter hidden md:block dark:text-white">MedFlow</h1>
          </div>
          
          <div className="flex-1 max-w-xl relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Pesquisar..." className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-700 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white transition-all font-medium" />
          </div>

          <div className="flex items-center gap-2 shrink-0">
             <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-200 transition-all shadow-sm"><Sun size={20} className="hidden dark:block"/><Moon size={20} className="dark:hidden"/></button>
             <button className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 shadow-sm"><Smartphone size={20} /></button>
             {view === 'list' && <button onClick={() => setView('form')} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-blue-700 shadow-lg active:scale-95 transition-all"><PlusCircle size={16} /> <span className="hidden sm:inline uppercase tracking-widest">ADMITIR</span></button>}
             {view !== 'list' && <button onClick={goBackToList} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 transition-all shadow-sm"><ArrowLeft size={20} /></button>}
             <button onClick={() => signOut(auth)} className="p-2 text-slate-400 hover:text-red-500 transition-colors ml-1"><LogOut size={22} /></button>
          </div>
        </div>
      </header>

      {notification && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-2xl text-white text-sm font-black animate-in slide-in-from-right fade-in duration-300 ${notification.type === 'error' ? 'bg-red-500' : 'bg-emerald-600'}`}>{notification.message}</div>
      )}

      {/* MODAL STATUS */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] w-full max-w-md shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <h3 className="font-black text-xl mb-6 flex items-center gap-3 dark:text-white"><Edit2 className="text-blue-500" /> Alterar Status</h3>
            <div className="space-y-6">
               <select className="w-full p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-bold dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" value={statusUpdateValue} onChange={(e) => setStatusUpdateValue(e.target.value)}>
                  <option value="Alta">Alta</option><option value="Observação">Observação</option><option value="Aguardando Vaga">Vaga</option><option value="Internado">Internado</option>
               </select>
               <textarea className="w-full p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 min-h-[100px] dark:text-white font-medium focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Motivo da alteração..." value={statusJustification} onChange={(e) => setStatusJustification(e.target.value)} />
               <div className="flex gap-4">
                  <button onClick={() => setIsStatusModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 hover:text-slate-600 transition-colors">CANCELAR</button>
                  <button onClick={handleUpdateStatus} disabled={!statusJustification.trim() || loading} className="flex-1 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-500/20 disabled:opacity-50">SALVAR</button>
               </div>
            </div>
          </div>
        </div>
      )}

      <main className="w-full max-w-7xl mx-auto px-4 py-8">
        {view === 'list' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div><h2 className="text-3xl font-black tracking-tight dark:text-white">Censo Privado</h2><p className="text-slate-500 dark:text-slate-400 font-bold italic text-sm">{user.email}</p></div>
              <button onClick={() => setShowDischarged(!showDischarged)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 transition-all hover:bg-slate-50 dark:hover:bg-slate-700"><Filter size={14}/> {showDischarged ? 'OCULTAR ALTAS' : 'MOSTRAR ALTAS'}</button>
            </div>

            {filteredPatients.length === 0 ? (
              <div className="py-24 text-center bg-white dark:bg-slate-800 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-700 shadow-sm"><ShieldCheck size={48} className="mx-auto mb-4 text-slate-300"/><p className="text-slate-400 font-black text-lg">Sem registos clínicos.</p><button onClick={() => setView('form')} className="text-blue-600 font-black mt-2 hover:underline tracking-widest uppercase">Admitir Paciente</button></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
                {filteredPatients.map(p => (
                  <Card key={p.id} onClick={() => openPatientDetails(p)} className="p-6 hover:scale-[1.02] relative border-slate-100 shadow-sm dark:shadow-none">
                    <div className="flex justify-between items-start mb-4">
                       <div><h3 className="font-black text-lg text-slate-800 dark:text-white leading-tight mb-1 group-hover:text-blue-500 transition-colors">{p.nome}</h3><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.idade} ANOS</div></div>
                       <Badge status={p.status} />
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/50 mb-6 font-medium text-xs text-slate-500 dark:text-slate-400 line-clamp-2 italic">“{p.hipotese}”</div>
                    <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-700 pt-4">
                        <div className="flex gap-4"><div className="text-center"><span className="text-[8px] font-black text-slate-300 block uppercase">PA</span><span className="text-xs font-black dark:text-slate-300">{p.pa}</span></div><div className="text-center"><span className="text-[8px] font-black text-slate-300 block uppercase">SAT</span><span className="text-xs font-black dark:text-slate-300">{p.sat}%</span></div></div>
                        {p.vitalsHistory && p.vitalsHistory.length > 1 && <SparkLine data={p.vitalsHistory.map(v => parseFloat(v.fc))} color="#3b82f6" />}
                        <ChevronRight className="text-slate-300 group-hover:text-blue-500 transition-colors" size={24} />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'form' && (
          <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-8 animate-in slide-in-from-bottom-10 duration-500">
             <div className="flex justify-between items-end bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700">
               <div><h2 className="text-4xl font-black tracking-tight dark:text-white leading-none mb-2">Admissão</h2><p className="text-slate-500 font-bold italic text-sm">O rascunho é guardado automaticamente enquanto escreve.</p></div>
               <div className="flex gap-3">
                 <button type="button" onClick={suggestCid} disabled={isCidLoading} title="Sugerir CID" className="p-4 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-2xl hover:scale-105 transition-all shadow-sm"><Brain size={24} /></button>
                 <button type="button" onClick={() => { if(confirm("Limpar rascunho?")) { setFormData(initialFormState); localStorage.removeItem('medflow-draft'); } }} className="p-4 bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded-2xl hover:bg-red-100 transition-all shadow-sm"><Trash2 size={24} /></button>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
               <div className="lg:col-span-2 space-y-8">
                  <Card className="p-8 shadow-xl border-0"><h3 className="font-black text-xl mb-8 flex items-center gap-3 text-blue-500 dark:text-blue-400"><Users size={24}/> Identidade</h3>
                    <Input label="Nome Completo" value={formData.nome} onChange={(e:any) => setFormData({...formData, nome: e.target.value})} required />
                    <div className="grid grid-cols-2 gap-6"><Input label="Idade" type="number" value={formData.idade} onChange={(e:any) => setFormData({...formData, idade: e.target.value})} /><Input label="P. Arterial" value={formData.pa} onChange={(e:any) => setFormData({...formData, pa: e.target.value})} placeholder="120/80" /></div>
                    <div className="grid grid-cols-3 gap-4">
                       <Input label="FC" value={formData.fc} onChange={(e:any) => setFormData({...formData, fc: e.target.value})} className="text-center" />
                       <Input label="SatO2" value={formData.sat} onChange={(e:any) => setFormData({...formData, sat: e.target.value})} className="text-center" />
                       <Input label="T(ºC)" value={formData.temp} onChange={(e:any) => setFormData({...formData, temp: e.target.value})} className="text-center" />
                    </div>
                  </Card>
                  <Card className="p-8 bg-slate-900 dark:bg-black text-white border-0 shadow-2xl rounded-[2rem]">
                     <h3 className="font-black text-xl text-blue-400 mb-8 border-b border-slate-800 pb-4 flex items-center gap-2"><Stethoscope size={22}/> Admissão Clínica</h3>
                     <TextArea label="Hipótese Diagnóstica" value={formData.hipotese} onChange={(e:any) => setFormData({...formData, hipotese: e.target.value})} placeholder="Quadro clínico inicial..." required />
                     <TextArea label="Conduta Proposta" value={formData.conduta} onChange={(e:any) => setFormData({...formData, conduta: e.target.value})} placeholder="Plano de tratamento..." required />
                     <div className="mb-6"><Label>Status Inicial</Label><select className="w-full p-4 rounded-2xl bg-slate-950 border-2 border-slate-800 text-white font-black outline-none focus:border-blue-500" value={formData.status} onChange={(e:any) => setFormData({...formData, status: e.target.value})}>
                        <option value="Alta">Alta</option><option value="Observação">Em Observação</option><option value="Aguardando Vaga">Aguardando Vaga</option><option value="Internado">Internado</option>
                     </select></div>
                     <button type="submit" disabled={loading} className="w-full bg-blue-600 py-5 rounded-3xl font-black text-lg hover:bg-blue-500 shadow-xl transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest">GUARDAR ADMISSÃO</button>
                  </Card>
               </div>
               <div className="lg:col-span-3 space-y-8">
                  <Card className="p-8 shadow-xl h-full border-0 rounded-[2rem]">
                     <h3 className="font-black text-xl mb-8 flex items-center gap-3 text-emerald-500 dark:text-emerald-400"><Activity size={24}/> Anamnese e Exame</h3>
                     <TextArea label="Queixa Principal" rows={2} value={formData.queixa} onChange={(e:any) => setFormData({...formData, queixa: e.target.value})} />
                     <TextArea label="HDA (História da Doença Atual)" rows={4} value={formData.hda} onChange={(e:any) => setFormData({...formData, hda: e.target.value})} />
                     <TextArea label="Exame Físico Detalhado" rows={6} value={formData.exameFisico} onChange={(e:any) => setFormData({...formData, exameFisico: e.target.value})} />
                  </Card>
               </div>
            </div>
          </form>
        )}

        {view === 'details' && selectedPatient && (
          <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-700 flex flex-col md:flex-row justify-between md:items-center gap-6 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-3 h-full bg-blue-600"></div>
               <div className="flex-1">
                  <div className="flex items-center gap-4 mb-3">
                    <h2 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white leading-tight">{selectedPatient.nome}</h2>
                    <div className="flex gap-2">
                       <button onClick={() => { setStatusUpdateValue(selectedPatient.status); setStatusJustification(''); setIsStatusModalOpen(true); }} className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full border border-blue-100 dark:border-blue-900/50 shadow-sm transition-all hover:scale-110"><Edit2 size={20} /></button>
                       <button onClick={async () => { if(confirm("Apagar prontuário permanentemente?")) { await deleteDoc(doc(db, 'artifacts', appId, 'users', user!.uid, 'consultas_medicas', selectedPatient.id)); goBackToList(); } }} className="p-2.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full border border-red-100 dark:border-red-900/50 shadow-sm transition-all hover:scale-110"><Trash2 size={20} /></button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest italic">
                    <span className="bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-xl text-slate-700 dark:text-slate-300">{selectedPatient.idade} ANOS</span>
                    <Badge status={selectedPatient.status} />
                    <span className="flex items-center gap-2"><Clock size={16} /> ADMITIDO A: {new Date(selectedPatient.createdAt?.seconds! * 1000).toLocaleString('pt-PT')}</span>
                  </div>
               </div>
               <div className="flex gap-3">
                  <button onClick={suggestCid} disabled={isCidLoading} className="bg-purple-600 text-white px-6 py-4 rounded-2xl font-black text-xs hover:bg-purple-700 flex items-center gap-2 shadow-lg active:scale-95 disabled:opacity-50 transition-all"><Brain size={20} /> CID-10</button>
                  <button onClick={exportPdf} className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-xs hover:bg-black flex items-center gap-2 shadow-lg active:scale-95 transition-all"><FileDown size={20} /> PDF</button>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
               <div className="lg:col-span-2 space-y-8">
                  <Card className="p-8 shadow-lg border-0 rounded-[2.5rem]">
                    <h3 className="font-black text-xl mb-8 flex items-center gap-3 text-red-500 dark:text-red-400"><Activity size={28}/> Tendências Vitais</h3>
                    <div className="grid grid-cols-2 gap-4 mb-8">
                       <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-inner"><span className="text-[9px] font-black text-slate-400 dark:text-slate-500 block mb-1 uppercase tracking-widest">P. Arterial</span><span className="font-black text-2xl dark:text-slate-200">{selectedPatient.pa || '-'}</span></div>
                       <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-inner"><span className="text-[9px] font-black text-slate-400 dark:text-slate-500 block mb-1 uppercase tracking-widest">SatO2</span><span className="font-black text-2xl dark:text-slate-200">{selectedPatient.sat || '-'}%</span></div>
                    </div>
                    {selectedPatient.vitalsHistory && selectedPatient.vitalsHistory.length > 1 && (
                      <div className="space-y-6 animate-in fade-in">
                         <div className="p-5 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl flex justify-between items-center border border-blue-50 dark:border-blue-900/20 shadow-sm"><span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Histórico FC</span><SparkLine data={selectedPatient.vitalsHistory.map(v => parseFloat(v.fc))} color="#3b82f6" /></div>
                         <div className="p-5 bg-red-50/50 dark:bg-red-900/10 rounded-2xl flex justify-between items-center border border-red-50 dark:border-red-900/20 shadow-sm"><span className="text-[9px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest">Histórico Temp</span><SparkLine data={selectedPatient.vitalsHistory.map(v => parseFloat(v.temp))} color="#ef4444" /></div>
                      </div>
                    )}
                  </Card>
                  
                  <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl border border-slate-800 text-slate-400">
                    <h3 className="font-black text-lg mb-6 flex items-center gap-3 text-blue-400 uppercase tracking-widest"><ShieldCheck size={22}/> Auditoria</h3>
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-3 custom-scrollbar">
                       {selectedPatient.auditLog?.map((log, i) => (
                         <div key={i} className="text-[10px] font-medium border-l-2 border-slate-800 pl-4 py-1 leading-relaxed animate-in fade-in"><span className="text-slate-600 font-mono block mb-1">{new Date(log.timestamp).toLocaleString('pt-PT')}</span><span className="text-blue-500/80 font-black mr-2 uppercase">{log.action}:</span> {log.details}</div>
                       ))}
                    </div>
                  </div>
               </div>

               <div className="lg:col-span-3 space-y-8">
                  <Card className="p-8 shadow-lg border-0 rounded-[2.5rem]">
                     <h3 className="font-black text-2xl mb-8 border-b border-slate-50 dark:border-slate-700 pb-4 flex items-center gap-3 text-purple-600 dark:text-purple-400"><History size={28}/> Diário e Evoluções</h3>
                     <div className="space-y-6">
                        {(!selectedPatient.evolutions || selectedPatient.evolutions.length === 0) && (
                          <div className="py-12 text-center bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border-2 border-dashed border-slate-100 dark:border-slate-800"><p className="text-slate-400 font-bold italic">Sem evoluções registadas até ao momento.</p></div>
                        )}
                        {selectedPatient.evolutions?.map((ev, i) => (
                          <div key={i} className={`p-6 rounded-3xl border shadow-sm relative transition-all animate-in fade-in slide-in-from-left-2 ${ev.text.includes('STATUS') ? 'bg-blue-50/40 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/50' : 'bg-white dark:bg-slate-900/50 border-slate-100 dark:border-slate-700'}`}>
                             <div className="text-[10px] font-black text-slate-300 dark:text-slate-500 mb-3 uppercase tracking-widest flex justify-between"><span>{new Date(ev.createdAt).toLocaleString('pt-PT')}</span><span className="opacity-40 font-bold">Dr. {user.email?.split('@')[0]}</span></div>
                             <p className="text-slate-700 dark:text-slate-300 font-bold leading-relaxed whitespace-pre-wrap">{ev.text}</p>
                          </div>
                        ))}
                        {selectedPatient.status !== 'Alta' && (
                          <div className="flex flex-col gap-4 pt-8 animate-in slide-in-from-bottom-4 duration-300">
                             <div className="relative">
                               <textarea value={evolutionText} onChange={(e) => setEvolutionText(e.target.value)} placeholder="Registe a evolução clínica..." className="w-full p-8 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/20 outline-none min-h-[180px] dark:text-white transition-all font-medium shadow-inner" />
                               <div className="absolute bottom-6 right-6 flex gap-2">
                                  <button onClick={() => {
                                    const vitals = `PA: ${selectedPatient.pa} | FC: ${selectedPatient.fc} | Sat: ${selectedPatient.sat}% | T: ${selectedPatient.temp}ºC`;
                                    const text = `PACIENTE: ${selectedPatient.nome}\nVITAI: ${vitals}\nHD: ${selectedPatient.hipotese}\nCONDUTA: ${selectedPatient.conduta}\nSTATUS: ${selectedPatient.status}`;
                                    const el = document.createElement('textarea'); el.value = text; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
                                    showNotification("Prontuário copiado!");
                                  }} title="Copiar prontuário rápido" className="p-5 rounded-3xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition-all shadow-lg active:scale-90"><Clipboard size={28} /></button>
                                  <button onClick={async () => {
                                    if(!evolutionText.trim()) return;
                                    setLoading(true);
                                    try {
                                      const pRef = doc(db, 'artifacts', appId, 'users', user.uid, 'consultas_medicas', selectedPatient.id);
                                      await updateDoc(pRef, { evolutions: arrayUnion({ text: evolutionText, createdAt: new Date().toISOString(), createdBy: user.uid }) });
                                      setEvolutionText(''); showNotification("Evolução guardada!");
                                    } catch(e) { showNotification("Erro ao guardar", "error"); } finally { setLoading(false); }
                                  }} disabled={loading || !evolutionText.trim()} className="bg-blue-600 text-white p-5 rounded-3xl hover:bg-blue-700 shadow-xl active:scale-90 transition-all disabled:opacity-50"><Send size={32} /></button>
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
