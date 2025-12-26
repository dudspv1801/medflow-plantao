import React, { useState, useEffect } from 'react';
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
  ArrowLeft,
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
  let shiftDate = new Date(date);
  let shiftName = '';
  let icon = null;

  // Turno Diurno: 07h às 18:59 | Turno Noturno: 19h às 06:59
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
    label: `${shiftDate.toLocaleDateString('pt-PT')} - ${shiftName}`,
    rawDate: shiftDate.setHours(0, 0, 0, 0),
    isNight: hour < 7 || hour >= 19,
    icon,
  };
};

// --- COMPONENTES UI (Preservando a sua estrutura original) ---

const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${
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
          Adicione o MedFlow ao ecrã inicial do seu telemóvel para aceder
          rapidamente como uma aplicação.
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
                <Share size={12} /> Partilhar
              </span>
              .
            </li>
            <li>
              Desça e toque em{' '}
              <span className="font-bold">Adicionar ao Ecrã Principal</span>.
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
              <span className="font-bold">Adicionar ao ecrã principal</span>.
            </li>
            <li>
              Confirme tocando em{' '}
              <span className="font-bold text-blue-600">Adicionar</span>.
            </li>
          </ol>
        </div>
      </div>

      <div className="p-4 border-t border-slate-100 bg-slate-50 text-center">
        <button
          onClick={onClose}
          className="text-blue-600 font-medium text-sm hover:underline"
        >
          Entendido, fechar
        </button>
      </div>
    </div>
  </div>
);

// --- COMPONENTE PRINCIPAL ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
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
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showDischarged, setShowDischarged] = useState(false);

  // Estados para o Modal de Status
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusUpdateValue, setStatusUpdateValue] = useState('');
  const [statusJustification, setStatusJustification] = useState('');

  // Injetar estilos de Reset diretamente (Garante layout full-width e evita erro de CSS ausente)
  useEffect(() => {
    const styleId = 'medflow-reset-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        #root { width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; text-align: left !important; }
        body { margin: 0; padding: 0; width: 100%; min-height: 100vh; display: block; background-color: #f8fafc; overflow-x: hidden; }
        input, button, textarea, select { font-family: inherit; }
      `;
      document.head.appendChild(style);
    }
  }, []);

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
    let metaThemeColor = document.querySelector('meta[name=theme-color]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', '#2563eb');

    let linkApple = document.querySelector(
      "link[rel='apple-touch-icon']"
    ) as HTMLLinkElement;
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
    return () => unsubscribe();
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

  // --- BUSCA DE DADOS PRIVADA (ISOLAMENTO POR USUÁRIO) ---
  useEffect(() => {
    if (!user) return;

    // Caminho Privado: Cada médico tem a sua própria lista
    const privateCol = collection(
      db,
      'artifacts',
      appId,
      'users',
      user.uid,
      'consultas_medicas'
    );

    const unsubscribe = onSnapshot(
      privateCol,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Patient[];

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
        showNotification('Erro de ligação', 'error');
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

  const goBackToList = () => {
    setSelectedPatient(null);
    setEvolutionText('');
    setView('list');
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
        'users',
        user.uid,
        'consultas_medicas',
        selectedPatient.id
      );
      const oldStatus = selectedPatient.status;

      const newEvolution: Evolution = {
        text: `🔄 MUDANÇA DE STATUS\nAnterior: ${oldStatus}\nNovo: ${statusUpdateValue}\nMotivo: ${statusJustification}`,
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
        'users',
        user.uid,
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
      const privateCol = collection(
        db,
        'artifacts',
        appId,
        'users',
        user.uid,
        'consultas_medicas'
      );
      await addDoc(privateCol, {
        ...formData,
        userId: user.uid,
        createdAt: serverTimestamp(),
        active: formData.status !== 'Alta',
        evolutions: [],
      });
      showNotification('Atendimento guardado na sua lista privada!');
      setFormData(initialFormState);
      setView('list');
    } catch (error) {
      console.error(error);
      showNotification('Erro ao guardar', 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA DE AGRUPAMENTO POR PLANTÃO ---
  const getGroupedPatients = () => {
    const filtered = patients.filter(
      (p) => showDischarged || p.status !== 'Alta'
    );
    const grouped: Record<string, { info: any; patients: Patient[] }> = {};

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
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-600 to-indigo-900 w-full p-4">
        <Card className="w-full max-w-md p-8 text-center mx-auto shadow-2xl bg-white/95 backdrop-blur-sm border-0 animate-in zoom-in duration-300">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-600 text-white p-4 rounded-3xl shadow-xl shadow-blue-500/20">
              <Stethoscope size={48} />
            </div>
          </div>
          <h1 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">
            MedFlow
          </h1>
          <p className="text-slate-500 mb-10 font-medium">
            Gestão Privada de Plantão Médico
          </p>

          {authError && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-xs font-bold border border-red-100 flex items-center justify-center gap-2">
              <AlertCircle size={14} />
              {authError}
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={handleGoogleLogin}
              disabled={authLoading}
              className="w-full bg-white border-2 border-slate-100 text-slate-700 py-4 rounded-2xl flex items-center justify-center gap-4 font-bold hover:bg-slate-50 hover:border-blue-300 transition-all shadow-sm active:scale-95 group"
            >
              {authLoading ? (
                <span className="w-6 h-6 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
              ) : (
                <img
                  src="https://www.google.com/favicon.ico"
                  alt="Google"
                  className="w-6 h-6"
                />
              )}
              Entrar com conta Google
            </button>

            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-left">
              <p className="text-[11px] text-blue-700 font-bold uppercase tracking-widest mb-1">
                🔒 Base de Dados Privada
              </p>
              <p className="text-[11px] text-blue-600 leading-tight">
                Cada médico acede exclusivamente aos seus pacientes. Os dados
                são isolados por conta.
              </p>
            </div>
          </div>
        </Card>
        <p className="mt-8 text-center text-blue-100/50 text-[10px] font-black uppercase tracking-widest">
          Acesso restrito a profissionais de saúde
        </p>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20 w-full overflow-x-hidden">
      <header className="bg-white shadow-sm sticky top-0 z-10 border-b border-slate-200 w-full">
        <div className="w-full max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setView('list')}
          >
            <div className="bg-blue-600 text-white p-2 rounded-lg">
              <Stethoscope size={20} />
            </div>
            <h1 className="font-black text-lg leading-none text-slate-800 hidden sm:block tracking-tight">
              MedFlow
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden lg:flex flex-col items-end mr-3 border-r border-slate-200 pr-3">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                Médico Autenticado
              </span>
              <span className="text-xs font-bold text-slate-600 max-w-[150px] truncate">
                {user.email}
              </span>
            </div>
            <button
              onClick={() => setShowInstallModal(true)}
              className="bg-indigo-50 text-indigo-600 p-2 rounded-full hover:bg-indigo-100 transition-colors"
              title="Instalar Aplicação"
            >
              <Smartphone size={20} />
            </button>
            {view !== 'list' && (
              <button
                onClick={goBackToList}
                className="px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all"
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">Voltar</span>
              </button>
            )}
            {view === 'list' && (
              <button
                onClick={() => setView('form')}
                className="px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95"
              >
                <PlusCircle size={16} />
                <span>Novo Paciente</span>
              </button>
            )}
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
          className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-2xl shadow-2xl text-white text-sm font-bold animate-in slide-in-from-right fade-in duration-300 ${
            notification.type === 'error' ? 'bg-red-500' : 'bg-emerald-600'
          }`}
        >
          {notification.message}
        </div>
      )}

      {showInstallModal && (
        <InstallModal onClose={() => setShowInstallModal(false)} />
      )}

      {isStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-black text-slate-800 flex items-center gap-2">
                <Edit2 size={20} className="text-blue-600" />
                Atualizar Status
              </h3>
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <Select
                label="Novo Status/Destino"
                required
                value={statusUpdateValue}
                onChange={(e) => setStatusUpdateValue(e.target.value)}
                options={[
                  { value: 'Alta', label: 'Alta Médica' },
                  { value: 'Observação', label: 'Em Observação' },
                  {
                    value: 'Aguardando Vaga',
                    label: 'Aguardando Vaga/Internação',
                  },
                  { value: 'Internado', label: 'Internado (Leito Definido)' },
                  { value: 'Transferido', label: 'Transferido' },
                ]}
              />

              <div>
                <Label required>Justificativa da Mudança</Label>
                <textarea
                  className="w-full px-4 py-3 border-2 border-slate-100 rounded-2xl bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all min-h-[100px] font-medium"
                  placeholder="Ex: Melhora clínica, vaga central confirmada..."
                  value={statusJustification}
                  onChange={(e) => setStatusJustification(e.target.value)}
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="px-6 py-2 text-slate-500 font-bold hover:bg-slate-200 rounded-xl transition-colors"
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
                className="px-8 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 active:scale-95"
              >
                {loading ? 'A processar...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="w-full max-w-6xl mx-auto px-4 py-8">
        {view === 'form' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">
                  Nova Admissão
                </h2>
                <p className="text-sm text-slate-500 font-medium">
                  Preencha os dados do atendimento inicial
                </p>
              </div>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 text-indigo-700 rounded-2xl hover:bg-indigo-100 transition-all font-bold text-sm shadow-sm"
              >
                <Clipboard size={18} />
                Copiar Texto
              </button>
            </div>
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 md:grid-cols-3 gap-8"
            >
              <div className="md:col-span-1 space-y-8">
                <Card className="p-6">
                  <h3 className="font-black text-slate-800 mb-6 flex items-center gap-3">
                    <Users size={20} className="text-blue-500" /> Identificação
                  </h3>
                  <Input
                    label="Nome Completo"
                    name="nome"
                    value={formData.nome}
                    onChange={handleInputChange}
                    placeholder="Nome do paciente"
                    required
                  />
                  <Input
                    label="Idade"
                    name="idade"
                    value={formData.idade}
                    onChange={handleInputChange}
                    type="number"
                  />
                </Card>
                <Card className="p-6 border-l-4 border-l-red-500">
                  <h3 className="font-black text-slate-800 mb-6 flex items-center gap-3">
                    <Activity size={20} className="text-red-500" /> Sinais
                    Vitais
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="PA (mmHg)"
                      name="pa"
                      value={formData.pa}
                      onChange={handleInputChange}
                      placeholder="120/80"
                    />
                    <Input
                      label="FC (bpm)"
                      name="fc"
                      value={formData.fc}
                      onChange={handleInputChange}
                      type="number"
                    />
                    <Input
                      label="SatO2 (%)"
                      name="sat"
                      value={formData.sat}
                      onChange={handleInputChange}
                      type="number"
                    />
                    <Input
                      label="T (ºC)"
                      name="temp"
                      value={formData.temp}
                      onChange={handleInputChange}
                      type="number"
                      step="0.1"
                    />
                  </div>
                </Card>
              </div>
              <div className="md:col-span-2 space-y-8">
                <Card className="p-6">
                  <h3 className="font-black text-slate-800 mb-6 flex items-center gap-3">
                    <FileText size={20} className="text-emerald-500" /> Anamnese
                    e Exame
                  </h3>
                  <TextArea
                    label="Queixa Principal"
                    name="queixa"
                    value={formData.queixa}
                    onChange={handleInputChange}
                    rows={2}
                  />
                  <TextArea
                    label="HDA (História da Doença Atual)"
                    name="hda"
                    value={formData.hda}
                    onChange={handleInputChange}
                    rows={3}
                  />
                  <TextArea
                    label="Exame Físico"
                    name="exameFisico"
                    value={formData.exameFisico}
                    onChange={handleInputChange}
                    rows={4}
                  />
                </Card>
                <Card className="p-6 border-l-4 border-l-purple-500 bg-purple-50/30">
                  <h3 className="font-black text-slate-800 mb-6 flex items-center gap-3">
                    <Stethoscope size={20} className="text-purple-500" />{' '}
                    Avaliação Diagnóstica
                  </h3>
                  <TextArea
                    label="Hipótese Diagnóstica"
                    name="hipotese"
                    value={formData.hipotese}
                    onChange={handleInputChange}
                    required
                  />
                  <TextArea
                    label="Conduta Inicial"
                    name="conduta"
                    value={formData.conduta}
                    onChange={handleInputChange}
                    required
                  />
                </Card>
                <Card
                  className={`p-8 transition-all duration-300 border-2 ${
                    formData.status !== 'Alta'
                      ? 'bg-orange-50/50 border-orange-200'
                      : 'bg-white border-slate-100'
                  }`}
                >
                  <h3 className="font-black text-slate-800 mb-6 flex items-center gap-3">
                    <LogOut size={20} className="text-orange-500" /> Desfecho e
                    Destino
                  </h3>
                  <Select
                    label="Status do Paciente"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    options={[
                      { value: 'Alta', label: 'Alta Médica' },
                      { value: 'Observação', label: 'Em Observação' },
                      {
                        value: 'Aguardando Vaga',
                        label: 'Aguardando Vaga/Internação',
                      },
                      {
                        value: 'Internado',
                        label: 'Internado (Leito Definido)',
                      },
                      { value: 'Transferido', label: 'Transferido' },
                    ]}
                  />
                  {formData.status !== 'Alta' && (
                    <div className="space-y-6 animate-in fade-in">
                      <Input
                        label="Pendências Iniciais"
                        name="pendencias"
                        value={formData.pendencias}
                        onChange={handleInputChange}
                        className="bg-white"
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input
                          label="Motivo da Internação"
                          name="motivoInternacao"
                          value={formData.motivoInternacao}
                          onChange={handleInputChange}
                          className="bg-white"
                        />
                        <Select
                          label="Situação AIH"
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
                  <div className="mt-10 flex justify-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-[1.5rem] font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {loading ? (
                        'A guardar...'
                      ) : (
                        <>
                          <Save size={20} /> Salvar Admissão
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
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-8 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-blue-600"></div>
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-3">
                  <h2 className="text-4xl font-black text-slate-800 tracking-tight leading-tight">
                    {selectedPatient.nome}
                  </h2>
                  <div className="flex items-center gap-2">
                    <Badge status={selectedPatient.status} />
                    <button
                      onClick={openStatusModal}
                      className="p-2 bg-blue-50/50 hover:bg-blue-100 text-blue-600 rounded-full transition-all shadow-sm border border-blue-100"
                      title="Alterar Status"
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-5 text-sm text-slate-500 font-bold">
                  <span className="bg-slate-100 px-3 py-1 rounded-lg text-slate-700">
                    {selectedPatient.idade} anos
                  </span>
                  <span className="flex items-center gap-2">
                    Admitido a:{' '}
                    {selectedPatient.createdAt
                      ? new Date(
                          selectedPatient.createdAt.seconds * 1000
                        ).toLocaleString('pt-PT')
                      : '-'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  const text = `PACIENTE: ${selectedPatient.nome}\nHD: ${selectedPatient.hipotese}\nCONDUTA: ${selectedPatient.conduta}`;
                  navigator.clipboard.writeText(text);
                  showNotification('Copiado com sucesso!');
                }}
                className="bg-slate-800 text-white px-8 py-3.5 rounded-2xl text-sm font-black hover:bg-slate-900 transition-all shadow-lg active:scale-95 flex items-center gap-2"
              >
                <Clipboard size={18} /> COPIAR PRONTUÁRIO
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <Card className="p-8 border-0 shadow-lg h-fit rounded-[2rem]">
                  <h3 className="font-black text-xl text-slate-800 mb-6 border-b border-slate-50 pb-4 flex items-center gap-3">
                    <FileText size={24} className="text-blue-500" />
                    Resumo de Admissão
                  </h3>
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-inner">
                        <span className="text-[10px] text-slate-400 block uppercase font-black tracking-widest mb-1">
                          P. Arterial
                        </span>
                        <span className="font-black text-lg text-slate-700">
                          {selectedPatient.pa || '-'}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-inner">
                        <span className="text-[10px] text-slate-400 block uppercase font-black tracking-widest mb-1">
                          F. Cardíaca
                        </span>
                        <span className="font-black text-lg text-slate-700">
                          {selectedPatient.fc || '-'}{' '}
                          <span className="text-[10px] font-medium opacity-50">
                            bpm
                          </span>
                        </span>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-inner">
                        <span className="text-[10px] text-slate-400 block uppercase font-black tracking-widest mb-1">
                          Saturação
                        </span>
                        <span className="font-black text-lg text-slate-700">
                          {selectedPatient.sat || '-'}{' '}
                          <span className="text-[10px] font-medium opacity-50">
                            %
                          </span>
                        </span>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-inner">
                        <span className="text-[10px] text-slate-400 block uppercase font-black tracking-widest mb-1">
                          Temp.
                        </span>
                        <span className="font-black text-lg text-slate-700">
                          {selectedPatient.temp || '-'}{' '}
                          <span className="text-[10px] font-medium opacity-50">
                            ºC
                          </span>
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                        Hipótese Diagnóstica
                      </span>
                      <p className="text-slate-800 font-bold text-lg leading-snug">
                        {selectedPatient.hipotese}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                        História (HDA)
                      </span>
                      <p className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        {selectedPatient.hda}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                        Conduta Inicial
                      </span>
                      <p className="text-slate-800 font-medium leading-relaxed italic bg-blue-50/70 p-5 rounded-3xl border border-blue-100">
                        {selectedPatient.conduta}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="lg:col-span-3 space-y-6">
                <h3 className="font-black text-xl text-slate-800 flex items-center gap-3 px-2">
                  <History size={26} className="text-purple-500" />
                  Evoluções Privadas
                </h3>
                <div className="space-y-4">
                  {(!selectedPatient.evolutions ||
                    selectedPatient.evolutions.length === 0) && (
                    <div className="py-16 text-center bg-slate-100/50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                      <p className="text-slate-400 font-bold italic">
                        Sem evoluções registadas até ao momento.
                      </p>
                    </div>
                  )}
                  {selectedPatient.evolutions &&
                    selectedPatient.evolutions.map((ev, index) => (
                      <div
                        key={index}
                        className={`bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden animate-in fade-in ${
                          ev.text.includes('MUDANÇA DE STATUS')
                            ? 'border-l-8 border-l-blue-400'
                            : 'border-l-8 border-l-purple-400'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                            {new Date(ev.createdAt).toLocaleString('pt-PT')}
                          </span>
                        </div>
                        <p className="text-slate-700 font-bold leading-relaxed whitespace-pre-wrap">
                          {ev.text}
                        </p>
                      </div>
                    ))}

                  {selectedPatient.status !== 'Alta' && (
                    <div className="flex flex-col gap-3 pt-4 animate-in slide-in-from-bottom-2 duration-300">
                      <textarea
                        value={evolutionText}
                        onChange={(e) => setEvolutionText(e.target.value)}
                        className="w-full p-6 border-2 border-slate-100 rounded-[2rem] focus:ring-4 focus:ring-blue-100 outline-none transition-all min-h-[150px] shadow-lg bg-white font-medium text-sm"
                        placeholder="Adicione uma evolução, exame ou nova conduta..."
                      ></textarea>
                      <button
                        onClick={handleAddEvolution}
                        disabled={loading || !evolutionText.trim()}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-blue-200 transition-all active:scale-95 disabled:opacity-50"
                      >
                        {loading ? (
                          'A processar...'
                        ) : (
                          <>
                            <Send size={24} /> Guardar Evolução
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'list' && (
          <div className="animate-in fade-in duration-300 space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
              <div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">
                  Censo Individual
                </h2>
                <p className="text-sm text-slate-500 font-bold italic opacity-70">
                  Aceda exclusivamente aos seus pacientes
                </p>
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <button
                  onClick={() => setShowDischarged(!showDischarged)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all border shadow-sm ${
                    showDischarged
                      ? 'bg-slate-200 text-slate-700 border-slate-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Filter size={16} />
                  {showDischarged ? 'Ocultar Altas' : 'Mostrar Altas'}
                </button>

                <div className="flex gap-2 text-[10px] font-black uppercase bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-xl">
                    <span className="mr-1">
                      {patients.filter((p) => p.status === 'Alta').length}
                    </span>{' '}
                    Alta
                  </div>
                  <div className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded-xl">
                    <span className="mr-1">
                      {patients.filter((p) => p.status === 'Observação').length}
                    </span>{' '}
                    Obs
                  </div>
                  <div className="px-3 py-1 bg-orange-50 text-orange-700 rounded-xl">
                    <span className="mr-1">
                      {
                        patients.filter((p) => p.status === 'Aguardando Vaga')
                          .length
                      }
                    </span>{' '}
                    Vaga
                  </div>
                </div>
              </div>
            </div>

            {patients.length === 0 ? (
              <div className="py-24 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
                <p className="text-slate-400 font-bold text-lg mb-4">
                  Inicie o seu plantão registando um paciente.
                </p>
                <button
                  onClick={() => setView('form')}
                  className="bg-blue-50 text-blue-600 px-8 py-3 rounded-2xl font-black hover:bg-blue-100 transition-colors"
                >
                  ADMITIR PRIMEIRO PACIENTE
                </button>
              </div>
            ) : (
              <div className="space-y-10">
                {getGroupedPatients().map(
                  ([shiftLabel, { info, patients: groupPatients }]) => (
                    <div
                      key={shiftLabel}
                      className="animate-in slide-in-from-bottom-4 duration-500 space-y-5"
                    >
                      <div
                        className={`flex items-center gap-3 px-1 border-l-4 pl-4 ${
                          info.isNight
                            ? 'border-indigo-500'
                            : 'border-orange-500'
                        }`}
                      >
                        <div
                          className={`p-2 rounded-xl ${
                            info.isNight
                              ? 'bg-indigo-50 text-indigo-600'
                              : 'bg-orange-50 text-orange-600'
                          }`}
                        >
                          {info.icon}
                        </div>
                        <h3 className="font-black text-slate-700 uppercase text-xs tracking-widest">
                          {shiftLabel}
                        </h3>
                        <span className="bg-slate-200 text-slate-600 text-[10px] font-black px-2 py-0.5 rounded-full">
                          {groupPatients.length}
                        </span>
                      </div>

                      <div className="hidden md:block bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              <th className="p-5">Paciente</th>
                              <th className="p-5">Hipótese / Conduta</th>
                              <th className="p-5">Status</th>
                              <th className="p-5">Admissão</th>
                              <th className="p-5 text-right">Ação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {groupPatients.map((patient) => (
                              <tr
                                key={patient.id}
                                onClick={() => openPatientDetails(patient)}
                                className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                              >
                                <td className="p-5 align-top">
                                  <div className="font-bold text-slate-800">
                                    {patient.nome}
                                  </div>
                                  <div className="text-xs text-slate-400 font-bold uppercase tracking-tighter">
                                    {patient.idade} anos
                                  </div>
                                </td>
                                <td className="p-5 align-top max-w-sm">
                                  <div className="font-bold text-slate-700 text-sm mb-1">
                                    {patient.hipotese}
                                  </div>
                                  <div className="text-xs text-slate-500 line-clamp-1 italic font-medium">
                                    {patient.conduta}
                                  </div>
                                </td>
                                <td className="p-5 align-top">
                                  <Badge status={patient.status} />
                                  {patient.evolutions &&
                                    patient.evolutions.length > 0 && (
                                      <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-purple-600 uppercase">
                                        <MessageSquare size={10} />{' '}
                                        {patient.evolutions.length} Evoluções
                                      </div>
                                    )}
                                </td>
                                <td className="p-5 align-top text-xs font-bold text-slate-400">
                                  {patient.createdAt
                                    ? new Date(
                                        patient.createdAt.seconds * 1000
                                      ).toLocaleTimeString('pt-PT', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : '-'}
                                </td>
                                <td className="p-5 align-top text-right">
                                  <ChevronRight
                                    size={24}
                                    className="ml-auto text-slate-300 group-hover:text-blue-600 transition-colors"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:hidden">
                        {groupPatients.map((patient) => (
                          <Card
                            key={patient.id}
                            onClick={() => openPatientDetails(patient)}
                            className="border-0 shadow-md p-5 active:scale-[0.98] transition-all"
                          >
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <div className="font-bold text-lg text-slate-800 leading-tight mb-1">
                                  {patient.nome}
                                </div>
                                <div className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">
                                  {patient.idade} anos
                                </div>
                              </div>
                              <Badge status={patient.status} />
                            </div>

                            <div className="bg-slate-50 rounded-2xl p-4 text-xs font-medium text-slate-600 border border-slate-100">
                              <div className="mb-2">
                                <span className="font-black text-[9px] text-slate-400 uppercase block mb-1">
                                  Hipótese
                                </span>
                                <span className="line-clamp-1">
                                  {patient.hipotese}
                                </span>
                              </div>
                              <div className="flex justify-between items-end border-t border-slate-200 pt-2 mt-2">
                                <span className="text-[10px] text-slate-400 font-bold">
                                  {patient.createdAt
                                    ? new Date(
                                        patient.createdAt.seconds * 1000
                                      ).toLocaleTimeString('pt-PT', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : 'Agora'}
                                </span>
                                {patient.evolutions &&
                                  patient.evolutions.length > 0 && (
                                    <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase">
                                      {patient.evolutions.length} Evoluções
                                    </span>
                                  )}
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
