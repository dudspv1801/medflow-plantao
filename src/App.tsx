import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import './App.css';
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
  query,
  where,
} from 'firebase/firestore';
import {
  Clipboard,
  PlusCircle,
  Users,
  Save,
  Activity,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  LogOut,
  Stethoscope,
  BedDouble,
  Ambulance,
  MessageSquare,
  Send,
  History,
  Smartphone,
  Share,
  X,
  ChevronRight,
  Filter,
  Sun,
  Moon,
  Edit2,
} from 'lucide-react';

// --- TIPAGENS (TYPESCRIPT) ---
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

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

interface TextAreaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
}

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
  apiKey: 'AIzaSyBmYfkgmYMHxDpx-8KlYXz0ZNFWP5B0Axo',
  authDomain: 'plantao-zero.firebaseapp.com',
  projectId: 'plantao-zero',
  storageBucket: 'plantao-zero.firebasestorage.app',
  messagingSenderId: '96539843160',
  appId: '1:96539843160:web:6c54cc238ba057b578882d',
  measurementId: 'G-RDKXGCZ7WE',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'plantao-zero-app';

// Variáveis globais injetadas pelo ambiente
declare global {
  interface Window {
    __initial_auth_token?: string;
  }
}
const initialAuthToken =
  typeof window !== 'undefined' ? window.__initial_auth_token : undefined;

// --- FUNÇÕES AUXILIARES DE TURNO ---
const getShiftInfo = (date: Date) => {
  const hour = date.getHours();
  // Definição de turno: Manhã (07:00 - 18:59), Noite (19:00 - 06:59)
  let shiftDate = new Date(date);
  let shiftName = '';
  let icon = null;

  if (hour >= 7 && hour < 19) {
    shiftName = 'Plantão Diurno';
    icon = <Sun size={16} className="text-orange-500" />;
  } else {
    shiftName = 'Plantão Noturno';
    icon = <Moon size={16} className="text-indigo-500" />;
    if (hour < 7) {
      // Ajusta para o dia anterior se for madrugada
      shiftDate.setDate(shiftDate.getDate() - 1);
    }
  }

  return {
    label: `${shiftDate.toLocaleDateString('pt-BR')} - ${shiftName}`,
    rawDate: shiftDate.setHours(0, 0, 0, 0),
    isNight: hour < 7 || hour >= 19,
    icon,
  };
};

// --- COMPONENTES UI ---

const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden ${
      onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
    } ${className}`}
  >
    {children}
  </div>
);

const Label: React.FC<{ children: React.ReactNode; required?: boolean }> = ({
  children,
  required,
}) => (
  <label className="block text-sm font-medium text-slate-700 mb-1">
    {children} {required && <span className="text-red-500">*</span>}
  </label>
);

const Input: React.FC<InputProps> = ({ label, required, ...props }) => (
  <div className="mb-4">
    <Label required={required}>{label}</Label>
    <input
      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
      {...props}
    />
  </div>
);

const TextArea: React.FC<TextAreaProps> = ({ label, required, ...props }) => (
  <div className="mb-4">
    <Label required={required}>{label}</Label>
    <textarea
      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all min-h-[100px]"
      {...props}
    />
  </div>
);

const Select: React.FC<SelectProps> = ({
  label,
  options,
  required,
  ...props
}) => (
  <div className="mb-4">
    <Label required={required}>{label}</Label>
    <select
      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white"
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

const Badge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    Alta: 'bg-green-100 text-green-800 border-green-200',
    Observação: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Aguardando Vaga': 'bg-orange-100 text-orange-800 border-orange-200',
    Internado: 'bg-red-100 text-red-800 border-red-200',
    Transferido: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  const icons: Record<string, React.ReactNode> = {
    Alta: <CheckCircle size={14} className="mr-1" />,
    Observação: <Activity size={14} className="mr-1" />,
    'Aguardando Vaga': <Clock size={14} className="mr-1" />,
    Internado: <BedDouble size={14} className="mr-1" />,
    Transferido: <Ambulance size={14} className="mr-1" />,
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        styles[status] || 'bg-gray-100 text-gray-800'
      }`}
    >
      {icons[status]}
      {status}
    </span>
  );
};

const InstallModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
      <div className="p-4 bg-blue-600 text-white flex justify-between items-center">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Smartphone size={20} />
          Instalar App
        </h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-blue-700 rounded-full transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div className="p-6 space-y-6">
        <p className="text-slate-600 text-sm">
          Adicione o MedFlow à tela inicial do seu celular para acessar
          rapidamente como um aplicativo.
        </p>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
            <span className="bg-black text-white text-xs px-1.5 py-0.5 rounded">
              iOS
            </span>{' '}
            iPhone/iPad
          </h4>
          <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
            <li>
              Toque no botão{' '}
              <span className="font-bold inline-flex items-center gap-1">
                <Share size={12} /> Compartilhar
              </span>
              .
            </li>
            <li>
              Role para baixo e toque em{' '}
              <span className="font-bold">Adicionar à Tela de Início</span>.
            </li>
            <li>
              Toque em{' '}
              <span className="font-bold text-blue-600">Adicionar</span>.
            </li>
          </ol>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
            <span className="bg-green-600 text-white text-xs px-1.5 py-0.5 rounded">
              Android
            </span>{' '}
            Chrome
          </h4>
          <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
            <li>
              Toque nos <span className="font-bold">três pontinhos (⋮)</span> no
              canto superior.
            </li>
            <li>
              Toque em{' '}
              <span className="font-bold">Adicionar à tela inicial</span>.
            </li>
            <li>
              Confirme tocando em{' '}
              <span className="font-bold text-blue-600">Adicionar</span>.
            </li>
          </ol>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
            <span className="bg-indigo-600 text-white text-xs px-1.5 py-0.5 rounded">
              PC
            </span>{' '}
            Chrome/Edge
          </h4>
          <p className="text-sm text-slate-600">
            Clique no ícone de instalação (monitor com seta para baixo) na barra
            de endereço do navegador.
          </p>
        </div>
      </div>

      <div className="p-4 border-t border-slate-100 bg-slate-50 text-center">
        <button
          onClick={onClose}
          className="text-blue-600 font-medium text-sm hover:underline"
        >
          Entendi, fechar
        </button>
      </div>
    </div>
  </div>
);

// --- COMPONENTE PRINCIPAL ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // THEME: improved dark mode (persistent + respects system preference)
  const getInitialTheme = (): 'light' | 'dark' => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch (e) {
      // ignore
    }
    return 'light';
  };

  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    typeof window === 'undefined' ? 'light' : getInitialTheme()
  );

  useEffect(() => {
    // Apply/remove the `dark` class (tailwind dark variant depends on this)
    document.documentElement.classList.toggle('dark', theme === 'dark');

    // Persist preference
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {
      // ignore
    }

    // Update theme-color meta for mobile address bar
    let metaThemeColor = document.querySelector('meta[name=theme-color]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', theme === 'dark' ? '#0f172a' : '#2563eb');
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  };

  const [view, setView] = useState<'list' | 'form' | 'details'>('list');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const [evolutionText, setEvolutionText] = useState('');
  const [searchTerm, setSearchTerm] = useState(''); // Estado para o texto da busca
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showDischarged, setShowDischarged] = useState(false);

  // Estados para o Modal de Status
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusUpdateValue, setStatusUpdateValue] = useState('');
  const [statusJustification, setStatusJustification] = useState('');

  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = 'https://cdn.tailwindcss.com';
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    document.title = 'MedFlow - Plantão';
    let linkApple = document.querySelector(
      "link[rel='apple-touch-icon']"
    ) as HTMLLinkElement | null;
    if (!linkApple) {
      linkApple = document.createElement('link');
      linkApple.rel = 'apple-touch-icon';
      linkApple.href =
        'https://cdn-icons-png.flaticon.com/512/3063/3063176.png';
      document.head.appendChild(linkApple);
    }
  }, []);

  const initialFormState = {
    nome: '',
    idade: '',
    queixa: '',
    hda: '',
    exameFisico:
      'BEG, LOTE, Mocorada, Hidratada, Eupneica, Afebril.\nACV: RCR em 2T, BNF, sem sopros.\nAR: MV+, sem RA.\nABD: Flácido, indolor, RHA+.\nMMII: Sem edemas, panturrilhas livres.',
    hipotese: '',
    conduta: '',
    status: 'Alta',
    pendencias: '',
    motivoInternacao: '',
    statusAIH: 'NaoSeAplica',
    pa: '',
    fc: '',
    sat: '',
    temp: '',
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    const initAuth = async () => {
      if (initialAuthToken) {
        try {
          await signInWithCustomToken(auth, initialAuthToken);
        } catch (e) {
          console.error('Erro token customizado', e);
        }
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Erro no login:', error);
      let msg = 'Erro ao fazer login.';
      if (error.code === 'auth/popup-closed-by-user') msg = 'Login cancelado.';
      if (error.code === 'auth/unauthorized-domain')
        msg = 'Domínio não autorizado no Firebase.';
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setPatients([]);
      setSelectedPatient(null);
    } catch (error) {
      console.error('Erro ao sair:', error);
    }
  };

  useEffect(() => {
    if (!user) return;

    // 1. Criamos a referência da coleção
    const collectionRef = collection(
      db,
      'artifacts',
      appId,
      'public',
      'data',
      'consultas_medicas'
    );

    // 2. Criamos a QUERY (o filtro) para buscar só onde o userId é igual ao id do médico logado
    const q = query(collectionRef, where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Patient[];

        // Ordenamos manualmente para evitar erros de índice composto inicialmente
        data.sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );

        setPatients(data);

        if (selectedPatient) {
          const updatedSelected = data.find((p) => p.id === selectedPatient.id);
          if (updatedSelected) setSelectedPatient(updatedSelected);
        }
      },
      (error) => {
        console.error('Erro ao buscar pacientes:', error);
        showNotification('Erro de conexão ou falta de permissão', 'error');
      }
    );
    return () => unsubscribe();
  }, [user, selectedPatient?.id]);

  const showNotification = (
    message: string,
    type: 'success' | 'error' = 'success'
  ) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const openPatientDetails = (patient: Patient) => {
    setSelectedPatient(patient);
    setView('details');
  };

  const openStatusModal = () => {
    if (selectedPatient) {
      setStatusUpdateValue(selectedPatient.status);
      setStatusJustification('');
      setIsStatusModalOpen(true);
    }
  };

  const handleUpdateStatus = async () => {
    if (
      !selectedPatient ||
      !statusUpdateValue ||
      !statusJustification.trim() ||
      !user
    )
      return;
    setLoading(true);
    try {
      const patientRef = doc(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        'consultas_medicas',
        selectedPatient.id
      );
      const oldStatus = selectedPatient.status;

      const newEvolution: Evolution = {
        text: `🔄 STATUS ALTERADO\nDe: ${oldStatus}\nPara: ${statusUpdateValue}\nMotivo: ${statusJustification}`,
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
      };

      await updateDoc(patientRef, {
        status: statusUpdateValue,
        active: statusUpdateValue !== 'Alta',
        evolutions: arrayUnion(newEvolution),
      });

      showNotification('Status atualizado com sucesso!');
      setIsStatusModalOpen(false);
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      showNotification('Erro ao atualizar status', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEvolution = async () => {
    if (!evolutionText.trim() || !selectedPatient || !user) return;
    setLoading(true);
    try {
      const patientRef = doc(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        'consultas_medicas',
        selectedPatient.id
      );
      const newEvolution: Evolution = {
        text: evolutionText,
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
      };
      await updateDoc(patientRef, {
        evolutions: arrayUnion(newEvolution),
      });
      showNotification('Evolução adicionada!');
      setEvolutionText('');
    } catch (error) {
      console.error('Erro ao evoluir:', error);
      showNotification('Erro ao salvar evolução', 'error');
    } finally {
      setLoading(false);
    }
  };

  const generateMedicalText = () => {
    const vitals = `PA: ${formData.pa || '-'} mmHg | FC: ${
      formData.fc || '-'
    } bpm | Sat: ${formData.sat || '-'}% | Temp: ${formData.temp || '-'}ºC`;
    let text = `PACIENTE: ${formData.nome} (${formData.idade} anos)\n\n`;
    text += `QUEIXA PRINCIPAL:\n${formData.queixa}\n\n`;
    text += `HDA:\n${formData.hda}\n\n`;
    text += `EXAME FÍSICO:\n${vitals}\n${formData.exameFisico}\n\n`;
    text += `HD:\n${formData.hipotese}\n\n`;
    text += `CONDUTA:\n${formData.conduta}\n\n`;
    text += `DESFECHO: ${formData.status.toUpperCase()}`;
    if (formData.status !== 'Alta') {
      if (formData.pendencias) text += `\nPENDÊNCIAS: ${formData.pendencias}`;
      if (formData.motivoInternacao)
        text += `\nMOTIVO INTERNAÇÃO: ${formData.motivoInternacao}`;
      if (formData.statusAIH !== 'NaoSeAplica')
        text += `\nSITUAÇÃO AIH: ${formData.statusAIH}`;
    }
    return text;
  };

  const copyToClipboard = () => {
    const text = generateMedicalText();
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
      const collectionRef = collection(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        'consultas_medicas'
      );
      await addDoc(collectionRef, {
        ...formData,
        userId: user.uid, // Garante que o paciente é seu
        createdAt: serverTimestamp(),
        active: formData.status !== 'Alta',
        evolutions: [],
      });
      showNotification('Atendimento salvo!');
      setFormData(initialFormState);
      setView('list');
    } catch (error) {
      console.error(error);
      showNotification('Erro ao salvar', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getGroupedPatients = () => {
    const filtered = patients.filter((p) => {
      const matchesSearch = p.nome
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesStatus = showDischarged || p.status !== 'Alta';
      return matchesSearch && matchesStatus;
    });

    const grouped: Record<string, { info: ReturnType<typeof getShiftInfo>; patients: Patient[] }> =
      {};

    filtered.forEach((patient) => {
      const date = patient.createdAt
        ? new Date(patient.createdAt.seconds * 1000)
        : new Date();
      const shiftInfo = getShiftInfo(date);
      const key = shiftInfo.label;

      if (!grouped[key]) {
        grouped[key] = { info: shiftInfo, patients: [] };
      }
      grouped[key].patients.push(patient);
    });

    return Object.entries(grouped).sort(
      ([, a], [, b]) => b.info.rawDate - a.info.rawDate
    );
  };

  if (!user)
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 px-4 w-full">
        <Card className="w-full max-w-md p-8 text-center mx-auto">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-600 text-white p-3 rounded-xl shadow-lg shadow-blue-200">
              <Stethoscope size={32} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">MedFlow</h1>
          <p className="text-slate-500 mb-8">Sistema de Gestão de Plantão</p>
          {authError && (
            <div className="mb-6 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100 flex items-center justify-center gap-2">
              <AlertCircle size={16} />
              {authError}
            </div>
          )}
          <button
            onClick={handleGoogleLogin}
            disabled={authLoading}
            className="w-full bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-3 transition-colors"
          >
            {authLoading ? (
              <span className="w-5 h-5 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
            ) : (
              <img
                src="https://www.google.com/favicon.ico"
                alt="Google"
                className="w-5 h-5"
              />
            )}
            Entrar com Google
          </button>
        </Card>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20 w-full">
      <header className="bg-white shadow-sm sticky top-0 z-10 border-b border-slate-200 w-full">
        <div className="w-full max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setView('list')}
          >
            <div className="bg-blue-600 text-white p-2 rounded-lg">
              <Stethoscope size={20} />
            </div>
            <h1 className="font-bold text-lg text-slate-800 hidden sm:block">
              MedFlow
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Identificação do Usuário Logado */}
            {user && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="User"
                    className="w-5 h-5 rounded-full"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] text-white">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-medium text-slate-600">
                  {user.displayName?.split(' ')[0] || user.email?.split('@')[0]}
                </span>
              </div>
            )}

            <button
              onClick={() => setShowInstallModal(true)}
              className="bg-indigo-50 text-indigo-600 p-2 rounded-full hover:bg-indigo-100 transition-colors"
            >
              <Smartphone size={20} />
            </button>

            <div className="h-6 w-px bg-slate-200 mx-1"></div>

            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {notification && (
        <div
          className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium flex items-center gap-2 animate-in slide-in-from-right fade-in duration-300 ${
            notification.type === 'error' ? 'bg-red-500' : 'bg-green-600'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertCircle size={18} />
          ) : (
            <CheckCircle size={18} />
          )}
          {notification.message}
        </div>
      )}

      {showInstallModal && (
        <InstallModal onClose={() => setShowInstallModal(false)} />
      )}

      {isStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Edit2 size={18} className="text-blue-600" />
                Atualizar Status
              </h3>
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800 mb-4">
                <p className="font-medium">O status atual é: {selectedPatient?.status}</p>
                <p className="text-xs opacity-75">Essa alteração será registrada no histórico.</p>
              </div>

              <Select
                label="Novo Status"
                required
                value={statusUpdateValue}
                onChange={(e) => setStatusUpdateValue(e.target.value)}
                options={[
                  { value: 'Alta', label: 'Alta Médica' },
                  { value: 'Observação', label: 'Em Observação' },
                  { value: 'Aguardando Vaga', label: 'Aguardando Vaga/Internação' },
                  { value: 'Internado', label: 'Internado (Leito Definido)' },
                  { value: 'Transferido', label: 'Transferido' },
                ]}
              />

              <div>
                <Label required>Justificativa da Mudança</Label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all min-h-[80px]"
                  placeholder="Ex: Paciente apresentou melhora, exame normal..."
                  value={statusJustification}
                  onChange={(e) => setStatusJustification(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 px-6">
              {/* Botão Theme (novo) */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-yellow-400"
                title={theme === 'dark' ? 'Ativar Modo Claro' : 'Ativar Modo Escuro'}
              >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
              
              {/* Espaço reservado para outros botões se necessário */}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateStatus}
                disabled={
                  loading ||
                  !statusJustification.trim() ||
                  statusUpdateValue === selectedPatient?.status
                }
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Salvando...' : 'Confirmar Mudança'}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="w-full max-w-6xl mx-auto px-4 py-6">
        {view === 'form' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800">Novo Atendimento</h2>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors font-medium text-sm"
              >
                <Clipboard size={18} />
                Copiar Texto
              </button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 space-y-6">
                <Card className="p-4">
                  <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <Users size={18} className="text-blue-500" /> Identificação
                  </h3>
                  <Input label="Nome" name="nome" value={formData.nome} onChange={handleInputChange} required />
                  <Input label="Idade" name="idade" value={formData.idade} onChange={handleInputChange} type="number" />
                </Card>
                <Card className="p-4">
                  <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <Activity size={18} className="text-red-500" /> Sinais Vitais
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="PA" name="pa" value={formData.pa} onChange={handleInputChange} />
                    <Input label="FC" name="fc" value={formData.fc} onChange={handleInputChange} type="number" />
                    <Input label="Sat" name="sat" value={formData.sat} onChange={handleInputChange} type="number" />
                    <Input label="Temp" name="temp" value={formData.temp} onChange={handleInputChange} type="number" step="0.1" />
                  </div>
                </Card>
              </div>
              <div className="md:col-span-2 space-y-6">
                <Card className="p-4">
                  <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <FileText size={18} className="text-emerald-500" /> Anamnese & Exame
                  </h3>
                  <TextArea label="Queixa" name="queixa" value={formData.queixa} onChange={handleInputChange} rows={2} />
                  <TextArea label="HDA" name="hda" value={formData.hda} onChange={handleInputChange} rows={3} />
                  <TextArea label="Exame Físico" name="exameFisico" value={formData.exameFisico} onChange={handleInputChange} rows={3} />
                </Card>
                <Card className="p-4 border-l-4 border-l-purple-500">
                  <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <Stethoscope size={18} className="text-purple-500" /> Avaliação
                  </h3>
                  <TextArea label="HD" name="hipotese" value={formData.hipotese} onChange={handleInputChange} required />
                  <TextArea label="Conduta" name="conduta" value={formData.conduta} onChange={handleInputChange} required />
                </Card>
                <Card className={`p-4 transition-all duration-300 ${formData.status !== 'Alta' ? 'bg-orange-50 border-orange-200' : 'bg-white'}`}>
                  <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <LogOut size={18} className="text-orange-500" /> Desfecho
                  </h3>
                  <Select
                    label="Status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    options={[
                      { value: 'Alta', label: 'Alta Médica' },
                      { value: 'Observação', label: 'Em Observação' },
                      { value: 'Aguardando Vaga', label: 'Aguardando Vaga/Internação' },
                      { value: 'Internado', label: 'Internado (Leito Definido)' },
                      { value: 'Transferido', label: 'Transferido' },
                    ]}
                  />
                  {formData.status !== 'Alta' && (
                    <div className="space-y-4 animate-in fade-in">
                      <Input label="Pendências" name="pendencias" value={formData.pendencias} onChange={handleInputChange} className="bg-white" />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Motivo Int." name="motivoInternacao" value={formData.motivoInternacao} onChange={handleInputChange} />
                        <Select
                          label="Status AIH"
                          name="statusAIH"
                          value={formData.statusAIH}
                          onChange={handleInputChange}
                          options={[
                            { value: 'NaoSeAplica', label: 'Não se aplica' },
                            { value: 'Pendente', label: 'Pendente' },
                            { value: 'Solicitada', label: 'Solicitada' },
                            { value: 'Emitida', label: 'Emitida' },
                          ]}
                        />
                      </div>
                    </div>
                  )}
                  <div className="mt-6 flex justify-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        'Salvando...'
                      ) : (
                        <>
                          <Save size={18} /> Salvar Atendimento
                        </>
                      )}
                    </button>
                  </div>
                </Card>
              </div>
            </form>
          </div>
        )}

        {view === 'details' && selectedPatient && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-3xl font-bold text-slate-800">{selectedPatient.nome}</h2>
                  <div className="flex items-center gap-2">
                    <Badge status={selectedPatient.status} />
                    <button
                      onClick={openStatusModal}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors"
                      title="Alterar Status"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                  <span>{selectedPatient.idade} anos</span>
                  <span>•</span>
                  <span>
                    Admitido em:{' '}
                    {selectedPatient.createdAt
                      ? new Date(selectedPatient.createdAt.seconds * 1000).toLocaleString('pt-BR')
                      : '-'}
                  </span>
                </div>
              </div>
              {selectedPatient.status !== 'Alta' && (
                <div className="flex items-center gap-2 bg-orange-50 text-orange-700 px-4 py-2 rounded-lg border border-orange-100">
                  <AlertCircle size={20} />
                  <span className="font-medium">Paciente Ativo no Plantão</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card className="p-6">
                  <h3 className="font-semibold text-lg text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                    <FileText size={20} className="text-blue-500" /> Admissão Original
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase">Queixa Principal</span>
                      <p className="text-slate-700 bg-slate-50 p-2 rounded-lg mt-1">{selectedPatient.queixa}</p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase">Sinais Vitais</span>
                        <div className="text-slate-700 bg-slate-50 p-2 rounded-lg mt-1 text-sm font-mono">
                          PA: {selectedPatient.pa} | FC: {selectedPatient.fc} | Sat: {selectedPatient.sat}%
                        </div>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase">Hipótese Diagnóstica</span>
                        <p className="text-slate-800 font-medium bg-slate-50 p-2 rounded-lg mt-1">{selectedPatient.hipotese}</p>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase">HDA</span>
                      <p className="text-slate-700 text-sm whitespace-pre-wrap mt-1">{selectedPatient.hda}</p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase">Exame Físico</span>
                      <p className="text-slate-700 text-sm whitespace-pre-wrap mt-1 bg-slate-50 p-3 rounded">{selectedPatient.exameFisico}</p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase">Conduta Inicial</span>
                      <p className="text-slate-700 text-sm whitespace-pre-wrap mt-1 bg-blue-50 p-3 rounded border border-blue-100">{selectedPatient.conduta}</p>
                    </div>
                  </div>
                </Card>
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg text-slate-800 flex items-center gap-2">
                    <History size={20} className="text-purple-500" /> Histórico de Evoluções
                  </h3>
                  {(!selectedPatient.evolutions || selectedPatient.evolutions.length === 0) && (
                    <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400">
                      Nenhuma evolução registrada além da admissão.
                    </div>
                  )}
                  {selectedPatient.evolutions && selectedPatient.evolutions.map((ev, index) => (
                    <div key={index} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative pl-10">
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-purple-200 rounded-l-xl"></div>
                      <div className="absolute left-3 top-4 bg-white border border-purple-200 p-1 rounded-full text-purple-600">
                        <MessageSquare size={14} />
                      </div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-slate-500 uppercase">Evolução Médica</span>
                        <span className="text-xs text-slate-400">{new Date(ev.createdAt).toLocaleString('pt-BR')}</span>
                      </div>
                      <p className="text-slate-700 whitespace-pre-wrap">{ev.text}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-1">
                {selectedPatient.status !== 'Alta' ? (
                  <Card className="p-4 sticky top-24 border-t-4 border-t-green-500">
                    <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <PlusCircle size={18} className="text-green-600" /> Nova Evolução
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">Registre a melhora clínica, resultados de exames ou novas condutas.</p>
                    <textarea
                      value={evolutionText}
                      onChange={(e) => setEvolutionText(e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none min-h-[150px] text-sm mb-3"
                      placeholder="Ex: Paciente refere melhora da dor. Troponina negativa. Mantenho em observação..."
                    />
                    <button
                      onClick={handleAddEvolution}
                      disabled={loading || !evolutionText.trim()}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Salvando...' : (<><Send size={16} /> Salvar Evolução</>)}
                    </button>
                  </Card>
                ) : (
                  <div className="bg-green-50 p-4 rounded-xl border border-green-200 text-green-800 text-center">
                    <CheckCircle size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="font-medium">Paciente recebeu alta.</p>
                    <p className="text-sm opacity-75">Não é possível adicionar evoluções.</p>
                  </div>
                )}
                {selectedPatient.pendencias && (
                  <div className="mt-4 bg-orange-50 p-4 rounded-xl border border-orange-200">
                    <h4 className="font-bold text-orange-800 text-sm mb-2 flex items-center gap-2">
                      <AlertCircle size={14} /> Pendências Iniciais
                    </h4>
                    <p className="text-sm text-orange-900">{selectedPatient.pendencias}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

       {view === 'list' && (
  <div className="animate-in fade-in duration-300">
    <div className="flex flex-col gap-6 mb-8">
      {/* Título e Botões de Ação */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold dark:text-white text-slate-800">Meus Pacientes</h2>
          <p className="text-slate-500 text-sm">Gerencie seus atendimentos</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* BOTÃO NOVO PACIENTE - Sempre Visível */}
          <button
            onClick={() => setView('form')}
            className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold transition-all shadow-md"
          >
            <PlusCircle size={20} />
            Novo Paciente
          </button>

          {/* Botão de Filtro de Altas */}
          <button
            onClick={() => setShowDischarged(!showDischarged)}
            className={`p-2.5 rounded-lg border transition-all ${
              showDischarged
                ? 'bg-slate-200 text-slate-700 border-slate-300'
                : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
            }`}
            title={showDischarged ? "Ocultar Altas" : "Mostrar Altas"}
          >
            <Filter size={20} />
          </button>
        </div>
      </div>

      {/* BARRA DE PESQUISA */}
      <div className="relative w-full">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {/* Usei o ícone de busca aqui para ficar mais intuitivo */}
          <Activity size={18} className="text-slate-400" /> 
        </div>
        <input
          type="text"
          placeholder="Pesquisar por nome do paciente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-10 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
        />
        {searchTerm && (
          <button 
            onClick={() => setSearchTerm('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>

    {/* LISTAGEM - Onde o resultado da busca aparece */}
    {getFilteredAndGroupedPatients().length === 0 ? (
      <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
        <p className="text-slate-400">Nenhum paciente encontrado.</p>
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="text-blue-500 font-medium mt-2 hover:underline"
          >
            Limpar pesquisa
          </button>
        )}
      </div>
    ) : (
      <div className="space-y-8">
        {/* Aqui continua o seu .map anterior que exibe os grupos de plantão */}
            </div>

            {patients.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                <p className="text-slate-400">Nenhum atendimento registrado ainda.</p>
                <button onClick={() => setView('form')} className="text-blue-500 font-medium mt-2 hover:underline">Começar atendimento</button>
              </div>
            ) : (
              <div className="space-y-8">
                {getGroupedPatients().map(([shiftLabel, { info, patients: groupPatients }]) => (
                  <div key={shiftLabel} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className={`flex items-center gap-2 mb-3 px-1 border-l-4 pl-3 ${info.isNight ? 'border-indigo-500' : 'border-orange-500'}`}>
                      <div className={`p-1.5 rounded-md ${info.isNight ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-600'}`}>
                        {info.icon}
                      </div>
                      <h3 className="font-bold text-slate-700 text-lg">{shiftLabel}</h3>
                      <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-medium">{groupPatients.length}</span>
                    </div>

                    <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <th className="p-4 font-semibold text-slate-600">Paciente</th>
                            <th className="p-4 font-semibold text-slate-600">Hipótese / Conduta</th>
                            <th className="p-4 font-semibold text-slate-600">Status</th>
                            <th className="p-4 font-semibold text-slate-600">Admissão</th>
                            <th className="p-4 font-semibold text-slate-600 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {groupPatients.map((patient) => (
                            <tr key={patient.id} onClick={() => openPatientDetails(patient)} className="hover:bg-blue-50 cursor-pointer transition-colors group">
                              <td className="p-4 align-top">
                                <div className="font-bold text-slate-800">{patient.nome}</div>
                                <div className="text-sm text-slate-500">{patient.idade} anos</div>
                              </td>
                              <td className="p-4 align-top max-w-xs">
                                <div className="font-medium text-slate-700 mb-1">{patient.hipotese}</div>
                                <div className="text-xs text-slate-500 line-clamp-1">{patient.conduta}</div>
                              </td>
                              <td className="p-4 align-top">
                                <Badge status={patient.status} />
                                {patient.evolutions && patient.evolutions.length > 0 && (
                                  <div className="mt-1 flex items-center gap-1 text-xs text-purple-600">
                                    <MessageSquare size={12} /> {patient.evolutions.length}
                                  </div>
                                )}
                              </td>
                              <td className="p-4 align-top text-sm text-slate-500">
                                {patient.createdAt ? new Date(patient.createdAt.seconds * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                              </td>
                              <td className="p-4 align-top text-right">
                                <ChevronRight size={20} className="ml-auto text-slate-400 group-hover:text-blue-600" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:hidden">
                      {groupPatients.map((patient) => (
                        <Card key={patient.id} onClick={() => openPatientDetails(patient)} className="hover:border-blue-300">
                          <div className="p-4 sm:p-5">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4 mb-3">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-bold text-lg text-slate-800 hover:text-blue-600 transition-colors">{patient.nome}</h3>
                                  <span className="text-slate-500 text-sm">({patient.idade} anos)</span>
                                </div>
                                <p className="text-sm font-medium text-slate-600 mb-1">{patient.hipotese}</p>
                                <p className="text-xs text-slate-400">
                                  Admitido em: {patient.createdAt ? new Date(patient.createdAt.seconds * 1000).toLocaleString('pt-BR') : 'Agora'}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <Badge status={patient.status} />
                                {patient.evolutions && patient.evolutions.length > 0 && (
                                  <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 flex items-center gap-1">
                                    <MessageSquare size={10} /> {patient.evolutions.length} evoluções
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 border border-slate-100">
                              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2">
                                <div>
                                  <span className="font-semibold text-xs text-slate-500 uppercase block mb-1">Conduta Inicial</span>
                                  <span className="line-clamp-2">{patient.conduta}</span>
                                </div>
                                {(patient.pendencias || patient.motivoInternacao) && (
                                  <div className="sm:border-l sm:border-slate-200 sm:pl-4 mt-2 sm:mt-0">
                                    {patient.pendencias && (
                                      <div className="mb-2">
                                        <span className="font-semibold text-xs text-orange-500 uppercase block mb-1">Pendências</span>
                                        <span className="line-clamp-1">{patient.pendencias}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
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
      </main>
    </div>
  );
}
