import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  signInWithCustomToken,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  arrayUnion,
  Timestamp,
} from 'firebase/firestore';
import {
  PlusCircle,
  Users,
  Activity,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  LogOut,
  Stethoscope,
  BedDouble,
  Ambulance,
  ArrowLeft,
  MessageSquare,
  Send,
  History,
  X,
  Filter,
  Sun,
  Moon,
  Edit2,
  Search,
  ChevronRight,
  Clipboard,
} from 'lucide-react';

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = JSON.parse('{"apiKey": "AIzaSyBmYfkgmYMHxDpx-8KlYXz0ZNFWP5B0Axo", "authDomain": "plantao-zero.firebaseapp.com", "projectId": "plantao-zero", "storageBucket": "plantao-zero.firebasestorage.app", "messagingSenderId": "96539843160", "appId": "1:96539843160:web:6c54cc238ba057b578882d", "measurementId": "G-RDKXGCZ7WE"}');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof (window as any).__app_id !== 'undefined' ? (window as any).__app_id : 'plantao-zero-app';

// --- TIPAGENS ---
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
  pendencias: string;
  motivoInternacao: string;
  statusAIH: string;
  pa: string;
  fc: string;
  sat: string;
  temp: string;
  userId: string;
  createdAt?: Timestamp;
  active: boolean;
  evolutions?: Evolution[];
}

// --- FUNÇÕES AUXILIARES ---
const getShiftInfo = (date: Date) => {
  const hour = date.getHours();
  let shiftDate = new Date(date);
  let shiftName = '';
  let icon = null;

  if (hour >= 7 && hour < 19) {
    shiftName = 'Plantão Diurno';
    icon = <Sun size={16} className="text-orange-500" />;
  } else {
    shiftName = 'Plantão Noturno';
    icon = <Moon size={16} className="text-indigo-500" />;
    if (hour < 7) shiftDate.setDate(shiftDate.getDate() - 1);
  }

  return {
    label: `${shiftDate.toLocaleDateString('pt-BR')} - ${shiftName}`,
    rawDate: shiftDate.setHours(0, 0, 0, 0),
    isNight: hour < 7 || hour >= 19,
    icon,
  };
};

// --- COMPONENTES UI ---

const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = '', onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden ${
      onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
    } ${className}`}
  >
    {children}
  </div>
);

const Badge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    Alta: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
    Observação: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
    'Aguardando Vaga': 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
    Internado: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
    Transferido: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  };
  const icons: Record<string, React.ReactNode> = {
    Alta: <CheckCircle size={14} className="mr-1" />,
    Observação: <Activity size={14} className="mr-1" />,
    'Aguardando Vaga': <Clock size={14} className="mr-1" />,
    Internado: <BedDouble size={14} className="mr-1" />,
    Transferido: <Ambulance size={14} className="mr-1" />,
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {icons[status]} {status}
    </span>
  );
};

// --- APP PRINCIPAL ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'list' | 'form' | 'details'>('list');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof localStorage !== 'undefined') return localStorage.getItem('theme') === 'dark';
    return false;
  });
  const [evolutionText, setEvolutionText] = useState('');
  const [showDischarged, setShowDischarged] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusUpdateValue, setStatusUpdateValue] = useState('');
  const [statusJustification, setStatusJustification] = useState('');

  const initialFormState = {
    nome: '', idade: '', queixa: '', hda: '',
    exameFisico: 'BEG, LOTE, Mucosa Corada, Hidratada, Eupneica, Afebril.\nACV: RCR em 2T, BNF, sem sopros.\nAR: MV+, sem RA.\nABD: Flácido, indolor, RHA+.\nMMII: Sem edemas, panturrilhas livres.',
    hipotese: '', conduta: '', status: 'Alta', pendencias: '', motivoInternacao: '', statusAIH: 'NaoSeAplica',
    pa: '', fc: '', sat: '', temp: '',
  };
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    const initAuth = async () => {
      const initialToken = (window as any).__initial_auth_token;
      if (initialToken) await signInWithCustomToken(auth, initialToken);
      else await signInWithPopup(auth, new GoogleAuthProvider());
    };
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u && !loading) initAuth().catch(console.error);
      setUser(u);
    });
    return () => unsubscribe();
  }, [loading]);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', appId, 'users', user.uid, 'consultas_medicas');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Patient));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setPatients(data);
      if (selectedPatient) {
        const updated = data.find(p => p.id === selectedPatient.id);
        if (updated) setSelectedPatient(updated);
      }
    }, (err) => showNotification('Erro ao carregar dados', 'error'));
    return () => unsubscribe();
  }, [user, selectedPatient?.id]);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleCopyToClipboard = () => {
    const vitals = `PA: ${formData.pa || '-'} | FC: ${formData.fc || '-'} | Sat: ${formData.sat || '-'} | Temp: ${formData.temp || '-'}`;
    let text = `PACIENTE: ${formData.nome} (${formData.idade} anos)\n\nQUEIXA:\n${formData.queixa}\n\nHDA:\n${formData.hda}\n\nEXAME FÍSICO:\n${vitals}\n${formData.exameFisico}\n\nHD: ${formData.hipotese}\nCONDUTA: ${formData.conduta}\nDESFECHO: ${formData.status}`;
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showNotification('Prontuário copiado!');
    } catch (err) {
      showNotification('Erro ao copiar', 'error');
    }
    document.body.removeChild(textArea);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'consultas_medicas'), {
        ...formData, userId: user.uid, createdAt: serverTimestamp(), active: formData.status !== 'Alta', evolutions: [],
      });
      showNotification('Atendimento salvo!');
      setFormData(initialFormState);
      setView('list');
    } catch (error) { showNotification('Erro ao salvar', 'error'); }
    finally { setLoading(false); }
  };

  const handleUpdateStatus = async () => {
    if (!selectedPatient || !statusUpdateValue || !statusJustification.trim() || !user) return;
    setLoading(true);
    try {
      const newEvolution = { text: `🔄 MUDANÇA DE STATUS: ${selectedPatient.status} → ${statusUpdateValue}\nMotivo: ${statusJustification}`, createdAt: new Date().toISOString(), createdBy: user.uid };
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'consultas_medicas', selectedPatient.id), {
        status: statusUpdateValue, active: statusUpdateValue !== 'Alta', evolutions: arrayUnion(newEvolution),
      });
      showNotification('Status atualizado!');
      setIsStatusModalOpen(false);
    } catch (error) { showNotification('Erro ao atualizar', 'error'); }
    finally { setLoading(false); }
  };

  const handleAddEvolution = async () => {
    if (!evolutionText.trim() || !selectedPatient || !user) return;
    setLoading(true);
    try {
      const newEv = { text: evolutionText, createdAt: new Date().toISOString(), createdBy: user.uid };
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'consultas_medicas', selectedPatient.id), { evolutions: arrayUnion(newEv) });
      showNotification('Evolução registrada!');
      setEvolutionText('');
    } catch (error) { showNotification('Erro ao salvar', 'error'); }
    finally { setLoading(false); }
  };

  const filteredPatients = useMemo(() => {
    return patients.filter(p => p.nome.toLowerCase().includes(searchTerm.toLowerCase()) && (showDischarged || p.status !== 'Alta'));
  }, [patients, searchTerm, showDischarged]);

  const groupedPatients = useMemo(() => {
    const grouped: Record<string, { info: any; patients: Patient[] }> = {};
    filteredPatients.forEach(p => {
      const date = p.createdAt ? new Date(p.createdAt.seconds * 1000) : new Date();
      const shift = getShiftInfo(date);
      if (!grouped[shift.label]) grouped[shift.label] = { info: shift, patients: [] };
      grouped[shift.label].patients.push(p);
    });
    return Object.entries(grouped).sort(([, a], [, b]) => b.info.rawDate - a.info.rawDate);
  }, [filteredPatients]);

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="flex justify-center mb-6"><div className="p-4 bg-blue-600 rounded-2xl text-white"><Stethoscope size={40} /></div></div>
        <h1 className="text-2xl font-bold mb-2">MedFlow</h1>
        <p className="text-slate-500 mb-8 italic">Carregando ambiente seguro...</p>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 shadow-sm border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setView('list'); setSearchTerm(''); }}>
            <div className="p-1.5 bg-blue-600 rounded-lg text-white"><Stethoscope size={20} /></div>
            <span className="font-bold text-lg hidden sm:block">MedFlow</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800"></div>
            {view === 'list' ? (
              <button onClick={() => setView('form')} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-md">
                <PlusCircle size={18} /> <span className="hidden sm:inline">Novo Paciente</span>
              </button>
            ) : (
              <button onClick={() => { setView('list'); setSelectedPatient(null); }} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                <ArrowLeft size={18} /> <span className="hidden sm:inline">Voltar</span>
              </button>
            )}
            <button onClick={() => signOut(auth)} className="p-2 text-slate-400 hover:text-red-500"><LogOut size={20} /></button>
          </div>
        </div>
      </header>

      {notification && (
        <div className={`fixed top-20 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm animate-in slide-in-from-right duration-300 ${notification.type === 'error' ? 'bg-red-500' : 'bg-green-600'}`}>
          {notification.message}
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-6">
        {view === 'list' && (
          <div className="animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-bold">Lista de Pacientes</h2>
                <p className="text-sm text-slate-500">Acesso exclusivo ao seu plantão</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text" placeholder="Pesquisar por nome..."
                    className="w-full sm:w-64 pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => setShowDischarged(!showDischarged)}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl border transition-all ${showDischarged ? 'bg-slate-200 dark:bg-slate-800' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}
                >
                  <Filter size={18} /> {showDischarged ? 'Ocultar Altas' : 'Ver Altas'}
                </button>
              </div>
            </div>

            {groupedPatients.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <p className="text-slate-400">Nenhum atendimento encontrado na sua base privada.</p>
              </div>
            ) : (
              <div className="space-y-10">
                {groupedPatients.map(([label, { info, patients: list }]) => (
                  <div key={label}>
                    <div className={`flex items-center gap-2 mb-4 px-1 border-l-4 pl-3 ${info.isNight ? 'border-indigo-500' : 'border-orange-500'}`}>
                      {info.icon} <h3 className="font-bold text-lg">{label}</h3>
                      <span className="bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full text-xs font-bold">{list.length}</span>
                    </div>

                    {/* VISUAL DA TABELA (DESKTOP) */}
                    <div className="hidden md:block bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-4">Paciente</th>
                            <th className="p-4">Hipótese / Conduta</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Hora</th>
                            <th className="p-4 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {list.map(p => (
                            <tr key={p.id} onClick={() => { setSelectedPatient(p); setView('details'); }} className="hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors group">
                              <td className="p-4">
                                <div className="font-bold">{p.nome}</div>
                                <div className="text-xs text-slate-500">{p.idade} anos</div>
                              </td>
                              <td className="p-4 max-w-xs">
                                <div className="font-medium text-sm line-clamp-1">{p.hipotese}</div>
                                <div className="text-[11px] text-slate-400 line-clamp-1 italic">{p.conduta}</div>
                              </td>
                              <td className="p-4"><Badge status={p.status} /></td>
                              <td className="p-4 text-xs text-slate-400">
                                {p.createdAt ? new Date(p.createdAt.seconds * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                              </td>
                              <td className="p-4 text-right text-slate-300 group-hover:text-blue-500 transition-colors"><ChevronRight size={20} className="ml-auto" /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* VISUAL DOS CARDS (MOBILE) */}
                    <div className="md:hidden space-y-4">
                      {list.map(p => (
                        <Card key={p.id} onClick={() => { setSelectedPatient(p); setView('details'); }} className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-bold text-lg">{p.nome}</div>
                              <div className="text-xs text-slate-500">{p.idade} anos</div>
                            </div>
                            <Badge status={p.status} />
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">{p.hipotese}</p>
                          <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
                            <span>{p.createdAt ? new Date(p.createdAt.seconds * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                            {p.evolutions && p.evolutions.length > 0 && <span className="text-blue-500">{p.evolutions.length} evoluções</span>}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'form' && (
          <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">Novo Atendimento</h2>
              <button onClick={handleCopyToClipboard} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-lg text-sm font-bold">
                <Clipboard size={16} /> Copiar Texto
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="font-bold mb-4 flex items-center gap-2 text-blue-500"><Users size={18} /> Identificação</h3>
                  <div className="space-y-4">
                    <label className="block">
                      <span className="text-xs font-bold text-slate-500 uppercase">Nome</span>
                      <input name="nome" value={formData.nome} onChange={handleInputChange} required className="w-full mt-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold text-slate-500 uppercase">Idade</span>
                      <input name="idade" type="number" value={formData.idade} onChange={handleInputChange} className="w-full mt-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                    </label>
                  </div>
                </Card>
                <Card className="p-6">
                  <h3 className="font-bold mb-4 flex items-center gap-2 text-red-500"><Activity size={18} /> Sinais Vitais</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <input name="pa" value={formData.pa} onChange={handleInputChange} placeholder="PA (120/80)" className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                    <input name="fc" type="number" value={formData.fc} onChange={handleInputChange} placeholder="FC (bpm)" className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                    <input name="sat" type="number" value={formData.sat} onChange={handleInputChange} placeholder="Sat (%)" className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                    <input name="temp" type="number" step="0.1" value={formData.temp} onChange={handleInputChange} placeholder="Temp (°C)" className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </Card>
              </div>
              <Card className="p-6">
                <h3 className="font-bold mb-4 flex items-center gap-2 text-emerald-500"><FileText size={18} /> Avaliação Clínica</h3>
                <div className="space-y-4">
                  <textarea name="queixa" value={formData.queixa} onChange={handleInputChange} placeholder="Queixa Principal..." className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]" />
                  <textarea name="hda" value={formData.hda} onChange={handleInputChange} placeholder="História da Doença Atual..." className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]" />
                  <textarea name="exameFisico" value={formData.exameFisico} onChange={handleInputChange} placeholder="Exame Físico..." className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]" />
                </div>
              </Card>
              <Card className="p-6 border-l-4 border-blue-500">
                <h3 className="font-bold mb-4 text-blue-600">Conclusão</h3>
                <div className="space-y-4">
                  <input name="hipotese" value={formData.hipotese} onChange={handleInputChange} required placeholder="Hipótese Diagnóstica..." className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                  <textarea name="conduta" value={formData.conduta} onChange={handleInputChange} required placeholder="Conduta Médica..." className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]" />
                  <select name="status" value={formData.status} onChange={handleInputChange} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="Alta">Alta Médica</option>
                    <option value="Observação">Observação</option>
                    <option value="Aguardando Vaga">Aguardando Vaga</option>
                    <option value="Internado">Internado</option>
                    <option value="Transferido">Transferido</option>
                  </select>
                </div>
              </Card>
              <div className="flex justify-end gap-3"><button type="submit" disabled={loading} className="px-10 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg disabled:opacity-50">{loading ? 'Salvando...' : 'Salvar Atendimento'}</button></div>
            </form>
          </div>
        )}

        {view === 'details' && selectedPatient && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between gap-4">
              <div>
                <h2 className="text-3xl font-extrabold mb-1">{selectedPatient.nome}</h2>
                <div className="text-sm text-slate-500">{selectedPatient.idade} anos • Admitido em {selectedPatient.createdAt ? new Date(selectedPatient.createdAt.seconds * 1000).toLocaleString('pt-BR') : '-'}</div>
              </div>
              <div className="flex items-center gap-3">
                <Badge status={selectedPatient.status} />
                <button onClick={() => { setStatusUpdateValue(selectedPatient.status); setStatusJustification(''); setIsStatusModalOpen(true); }} className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-full transition-colors"><Edit2 size={18} /></button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card className="p-6">
                  <h3 className="font-bold text-lg mb-4 border-b dark:border-slate-800 pb-2 flex items-center gap-2"><FileText size={20} className="text-blue-500" /> Prontuário de Admissão</h3>
                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Sinais Vitais</span>
                      <div className="text-sm font-mono mt-1 bg-slate-50 dark:bg-slate-800/50 p-2 rounded">PA {selectedPatient.pa} | FC {selectedPatient.fc} | Sat {selectedPatient.sat}% | T {selectedPatient.temp}°C</div>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Hipótese</span>
                      <p className="font-bold text-blue-600 dark:text-blue-400 mt-1">{selectedPatient.hipotese}</p>
                    </div>
                  </div>
                  <div className="space-y-4 text-sm">
                    <p><strong>Queixa:</strong> {selectedPatient.queixa}</p>
                    <p className="whitespace-pre-wrap"><strong>HDA:</strong> {selectedPatient.hda}</p>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"><strong>Exame Físico:</strong><br/>{selectedPatient.exameFisico}</div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg"><strong>Conduta:</strong><br/>{selectedPatient.conduta}</div>
                  </div>
                </Card>

                <div className="space-y-4">
                  <h3 className="font-bold text-lg flex items-center gap-2 px-2"><History size={20} className="text-purple-500" /> Histórico de Evoluções</h3>
                  {selectedPatient.evolutions?.map((ev, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500"></div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase mb-2"><span>Evolução Médica</span><span>{new Date(ev.createdAt).toLocaleString('pt-BR')}</span></div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{ev.text}</p>
                    </div>
                  ))}
                  {(!selectedPatient.evolutions || selectedPatient.evolutions.length === 0) && <div className="text-center py-10 text-slate-400 italic text-sm">Nenhuma evolução registrada até o momento.</div>}
                </div>
              </div>

              <div className="lg:col-span-1 space-y-4">
                {selectedPatient.status !== 'Alta' && (
                  <Card className="p-4 border-t-4 border-green-500 sticky top-24">
                    <h3 className="font-bold mb-3 flex items-center gap-2 text-green-600"><Send size={16} /> Nova Evolução</h3>
                    <textarea
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl outline-none min-h-[160px] text-sm mb-3 focus:ring-2 focus:ring-green-500"
                      placeholder="Descreva a evolução clínica..." value={evolutionText} onChange={(e) => setEvolutionText(e.target.value)}
                    />
                    <button onClick={handleAddEvolution} disabled={loading || !evolutionText.trim()} className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50">Registrar Evolução</button>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL DE STATUS */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center"><h3 className="font-extrabold text-xl">Atualizar Status</h3><button onClick={() => setIsStatusModalOpen(false)}><X size={24} /></button></div>
            <div className="p-6 space-y-6">
              <label className="block font-bold text-sm text-slate-500 uppercase tracking-wider">Novo Status
                <select value={statusUpdateValue} onChange={(e) => setStatusUpdateValue(e.target.value)} className="w-full mt-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-normal">
                  <option value="Alta">Alta Médica</option><option value="Observação">Observação</option><option value="Aguardando Vaga">Aguardando Vaga</option><option value="Internado">Internado</option><option value="Transferido">Transferido</option>
                </select>
              </label>
              <label className="block font-bold text-sm text-slate-500 uppercase tracking-wider">Justificativa
                <textarea placeholder="Ex: Paciente estável..." className="w-full mt-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] font-normal" value={statusJustification} onChange={(e) => setStatusJustification(e.target.value)} />
              </label>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
              <button onClick={() => setIsStatusModalOpen(false)} className="px-6 py-2 font-bold text-slate-500">Cancelar</button>
              <button onClick={handleUpdateStatus} disabled={loading || !statusJustification.trim()} className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg disabled:opacity-50">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
