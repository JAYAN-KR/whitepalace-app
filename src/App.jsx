import React, { useState, useEffect, useMemo } from 'react';
import {
  Home, FileText, Bell, MessageSquare, Phone, Users, Settings, Plus, DollarSign, CreditCard, CheckCircle, X, AlertCircle, Menu, LogOut
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, addDoc } from 'firebase/firestore';

// --- Firebase Initialization ---
// Your real Firebase keys from your project settings
const firebaseConfig = {
  apiKey: "AIzaSyAHefV0paQY98tW9GdVX4Gt90HpixVv5mI",
  authDomain: "white-palace-manager.firebaseapp.com",
  projectId: "white-palace-manager",
  storageBucket: "white-palace-manager.firebasestorage.app",
  messagingSenderId: "462608694487",
  appId: "1:462608694487:web:373fe08ed8eb6698c4c492"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'skyline-mews-app';

// --- Shared Components ---
const Toast = ({ message, type, onClose }) => {
  if (!message) return null;
  const bgColor = type === 'error' ? 'bg-red-500' : 'bg-green-500';
  return (
    <div className={`fixed bottom-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg flex items-center z-50 animate-bounce`}>
      <span>{message}</span>
      <button onClick={onClose} className="ml-4 hover:text-gray-200"><X size={18} /></button>
    </div>
  );
};

const Modal = ({ isOpen, title, children, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-full">
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full text-gray-500"><X size={20} /></button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState({ message: '', type: '' });

  const [profiles, setProfiles] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [payments, setPayments] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [settings, setSettings] = useState({ maintenanceAmount: 1200, currency: 'INR' });

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth error:", error);
        showToast("Authentication failed. Please ensure Anonymous Auth is enabled in Firebase.", "error");
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const collections = ['profiles', 'ledger', 'payments', 'announcements', 'messages', 'contacts', 'settings'];
    const unsubscribers = [];

    collections.forEach(colName => {
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', colName);
      const unsubscribe = onSnapshot(colRef, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        switch (colName) {
          case 'profiles':
            setProfiles(data);
            const myProfile = data.find(p => p.uid === user.uid);
            if (myProfile) setProfile(myProfile);
            break;
          case 'ledger': setLedger(data); break;
          case 'payments': setPayments(data); break;
          case 'announcements': setAnnouncements(data); break;
          case 'messages': setMessages(data); break;
          case 'contacts': setContacts(data); break;
          case 'settings':
            if (data.length > 0) {
              const globalSettings = data.find(s => s.id === 'global') || data[0];
              setSettings(globalSettings);
            }
            break;
        }
      }, (error) => console.error(`Error fetching ${colName}:`, error));
      unsubscribers.push(unsubscribe);
    });
    return () => unsubscribers.forEach(unsub => unsub());
  }, [user]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: '' }), 4000);
  };

  const getCollectionRef = (colName) => collection(db, 'artifacts', appId, 'public', 'data', colName);

  const ledgerStats = useMemo(() => {
    const sorted = [...ledger].sort((a, b) => a.timestamp - b.timestamp);
    let balance = 0, totalIncome = 0, totalExpense = 0, monthlyIncome = 0, monthlyExpense = 0;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const processedLedger = sorted.map(entry => {
      const amount = Number(entry.amount);
      if (entry.type === 'Income') { balance += amount; totalIncome += amount; }
      else { balance -= amount; totalExpense += amount; }

      const entryDate = new Date(entry.timestamp);
      if (entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear) {
        if (entry.type === 'Income') monthlyIncome += amount;
        else monthlyExpense += amount;
      }
      return { ...entry, runningBalance: balance };
    }).reverse();

    return { processedLedger, netBalance: balance, totalIncome, totalExpense, monthlyIncome, monthlyExpense, monthlyBalance: monthlyIncome - monthlyExpense };
  }, [ledger]);

  if (!isAuthReady) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Loading Community Workspace...</div>;
  if (!user) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Authenticating session...</div>;
  if (!profile) return <ProfileSetup user={user} onComplete={() => showToast("Profile Created!")} db={db} appId={appId} />;

  const handleLogout = async () => { await signOut(auth); window.location.reload(); };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, roles: ['Admin', 'Owner', 'Tenant'] },
    { id: 'ledger', label: 'Accounts Ledger', icon: FileText, roles: ['Admin', 'Owner', 'Tenant'] },
    { id: 'announcements', label: 'Announcements', icon: Bell, roles: ['Admin', 'Owner', 'Tenant'] },
    { id: 'messages', label: 'Messages', icon: MessageSquare, roles: ['Admin', 'Owner', 'Tenant'] },
    { id: 'residents', label: 'Directory', icon: Users, roles: ['Admin'] },
    { id: 'contacts', label: 'Contacts', icon: Phone, roles: ['Admin', 'Owner', 'Tenant'] },
    { id: 'settings', label: 'Settings', icon: Settings, roles: ['Admin'] },
  ];

  const allowedTabs = tabs.filter(t => t.roles.includes(profile.role));

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans text-slate-800">
      <div className="md:w-64 bg-slate-900 text-slate-200 flex flex-col md:min-h-screen shadow-xl z-20">
        <div className="p-4 bg-slate-950 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">White Palace Apartment</h1>
            <p className="text-xs text-slate-400 capitalize">{profile.role} Portal</p>
          </div>
          <button className="md:hidden text-slate-300" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}><Menu size={24} /></button>
        </div>
        <nav className={`flex-1 overflow-y-auto py-4 ${isMobileMenuOpen ? 'block' : 'hidden md:block'}`}>
          <div className="px-4 mb-6">
            <div className="bg-slate-800 rounded-lg p-3 text-sm">
              <p className="font-medium text-white">{profile.name}</p>
              <p className="text-slate-400">Flat: {profile.flatNumber}</p>
            </div>
          </div>
          <ul className="space-y-1 px-2">
            {allowedTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <li key={tab.id}>
                  <button onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 text-slate-300'}`}>
                    <Icon size={20} className={isActive ? 'text-white' : 'text-slate-400'} />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="p-4 hidden md:block border-t border-slate-800">
          <button onClick={handleLogout} className="flex items-center space-x-2 text-slate-400 hover:text-white w-full px-2 py-2">
            <LogOut size={18} /><span>Sign Out</span>
          </button>
        </div>
      </div>
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {activeTab === 'dashboard' && <Dashboard profile={profile} settings={settings} payments={payments} ledgerStats={ledgerStats} showToast={showToast} getCollectionRef={getCollectionRef} />}
          {activeTab === 'ledger' && <LedgerView profile={profile} ledgerStats={ledgerStats} showToast={showToast} getCollectionRef={getCollectionRef} />}
          {activeTab === 'announcements' && <AnnouncementsView profile={profile} announcements={announcements} showToast={showToast} getCollectionRef={getCollectionRef} />}
          {activeTab === 'messages' && <MessagesView profile={profile} messages={messages} showToast={showToast} getCollectionRef={getCollectionRef} />}
          {activeTab === 'residents' && <DirectoryView profiles={profiles} payments={payments} showToast={showToast} getCollectionRef={getCollectionRef} />}
          {activeTab === 'contacts' && <ContactsView profile={profile} contacts={contacts} showToast={showToast} getCollectionRef={getCollectionRef} />}
          {activeTab === 'settings' && <SettingsView settings={settings} showToast={showToast} getCollectionRef={getCollectionRef} />}
        </main>
      </div>
      <Toast {...toast} onClose={() => setToast({ message: '', type: '' })} />
    </div>
  );
}

const ProfileSetup = ({ user, onComplete, db, appId }) => {
  const [formData, setFormData] = useState({ name: '', flatNumber: '', phone: '', role: 'Owner' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid), { uid: user.uid, ...formData, createdAt: Date.now() });
      onComplete();
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome to White Palace Apartment</h2>
        <p className="text-slate-500 mb-6">Let's set up your profile for the community portal.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label><input required type="text" className="w-full p-3 border border-slate-300 rounded-lg" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Flat Number (e.g., B302)</label><input required type="text" className="w-full p-3 border border-slate-300 rounded-lg uppercase" value={formData.flatNumber} onChange={e => setFormData({ ...formData, flatNumber: e.target.value.toUpperCase() })} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label><input required type="tel" className="w-full p-3 border border-slate-300 rounded-lg" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Your Role</label>
            <select className="w-full p-3 border border-slate-300 rounded-lg" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
              <option value="Owner">Resident (Owner)</option><option value="Tenant">Tenant</option><option value="Admin">Management Committee (Admin)</option>
            </select>
          </div>
          <button disabled={loading} type="submit" className="w-full bg-blue-600 text-white p-3 rounded-lg font-medium hover:bg-blue-700 transition-colors mt-6">{loading ? 'Saving...' : 'Enter Portal'}</button>
        </form>
      </div>
    </div>
  );
};

const Dashboard = ({ profile, settings, payments, ledgerStats, showToast, getCollectionRef }) => {
  const currentMonthStr = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  if (profile.role === 'Admin') {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-800">Admin Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Bank Balance" value={`₹${ledgerStats.netBalance}`} icon={DollarSign} color="blue" />
          <StatCard title="Total Income" value={`₹${ledgerStats.totalIncome}`} icon={CheckCircle} color="green" />
          <StatCard title="Total Expenses" value={`₹${ledgerStats.totalExpense}`} icon={AlertCircle} color="red" />
          <StatCard title="Monthly Balance" value={`₹${ledgerStats.monthlyBalance}`} icon={FileText} color="purple" />
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 rounded-lg text-center border border-slate-100">
              <p className="text-sm text-slate-500 mb-1">Current Maintenance</p>
              <p className="text-xl font-bold text-slate-800">₹{settings.maintenanceAmount}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const myPayments = payments.filter(p => p.residentUID === profile.uid).sort((a, b) => b.timestamp - a.timestamp);
  const hasPaidCurrentMonth = myPayments.some(p => p.paymentMonth === currentMonthStr && p.status === 'Paid');

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [utrNumber, setUtrNumber] = useState('');

  const isBankConfigured = settings.upiId || (settings.accountNumber && settings.ifscCode);
  const upiString = settings.upiId
    ? `upi://pay?pa=${settings.upiId}&pn=${encodeURIComponent(settings.accountName || 'WHITE PALACE ASSOCIATION')}&am=${settings.maintenanceAmount}&cu=INR&tn=Flat_${profile.flatNumber}_Maintenance`
    : (settings.accountNumber && settings.ifscCode)
      ? `upi://pay?pa=${settings.accountNumber}@${settings.ifscCode}.ifsc.npci&pn=${encodeURIComponent(settings.accountName || 'WHITE PALACE ASSOCIATION')}&am=${settings.maintenanceAmount}&cu=INR&tn=Flat_${profile.flatNumber}_Maintenance`
      : '#';

  const handlePayment = async () => {
    if (!utrNumber || utrNumber.length < 6) { showToast("Please enter a valid Transaction ID/UTR.", "error"); return; }
    setIsProcessing(true);
    try {
      await addDoc(getCollectionRef('payments'), { residentUID: profile.uid, flatNumber: profile.flatNumber, residentName: profile.name, paymentMonth: currentMonthStr, amount: settings.maintenanceAmount, status: 'Paid', method: 'UPI', transactionID: utrNumber, timestamp: Date.now() });
      await addDoc(getCollectionRef('ledger'), { date: new Date().toISOString().split('T')[0], type: 'Income', description: `Maintenance - ${profile.flatNumber} - ${currentMonthStr} (Ref: ${utrNumber})`, amount: Number(settings.maintenanceAmount), timestamp: Date.now(), createdByAdmin: false, flatNumber: profile.flatNumber });
      showToast("Payment Recorded Successfully!");
      setIsPaymentModalOpen(false);
      setUtrNumber('');
    } catch (err) { showToast("Payment failed to record.", "error"); }
    setIsProcessing(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Welcome, {profile.name}</h2>
      <div className={`p-6 rounded-xl shadow-md border ${hasPaidCurrentMonth ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Maintenance: {currentMonthStr}</h3>
            <p className={`text-sm mt-1 ${hasPaidCurrentMonth ? 'text-green-600' : 'text-orange-600'}`}>{hasPaidCurrentMonth ? 'You have paid for this month. Thank you!' : `Amount Due: ₹${settings.maintenanceAmount}`}</p>
          </div>
          {!hasPaidCurrentMonth && profile.role !== 'Tenant' && (<button onClick={() => setIsPaymentModalOpen(true)} className="mt-4 md:mt-0 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center"><CreditCard size={18} className="mr-2" />Pay to WHITE PALACE ASSOCIATION</button>)}
          {!hasPaidCurrentMonth && profile.role === 'Tenant' && (<p className="mt-4 md:mt-0 text-sm font-medium text-orange-600 bg-orange-100 px-4 py-2 rounded-lg">Pending Owner Payment</p>)}
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50"><h3 className="font-bold text-slate-800">Your Payment History</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200"><tr><th className="p-4 font-medium">Month</th><th className="p-4 font-medium">Date</th><th className="p-4 font-medium">Amount</th><th className="p-4 font-medium">Txn ID</th><th className="p-4 font-medium">Status</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {myPayments.length === 0 ? (<tr><td colSpan="5" className="p-6 text-center text-slate-500">No payment history found.</td></tr>) : (myPayments.map(p => (<tr key={p.id} className="hover:bg-slate-50 transition-colors"><td className="p-4 font-medium text-slate-800">{p.paymentMonth}</td><td className="p-4 text-slate-600">{new Date(p.timestamp).toLocaleDateString()}</td><td className="p-4 text-slate-800">₹{p.amount}</td><td className="p-4 text-slate-500 font-mono text-xs">{p.transactionID}</td><td className="p-4"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{p.status}</span></td></tr>)))}
            </tbody>
          </table>
        </div>
      </div>
      <Modal isOpen={isPaymentModalOpen} title="Complete Payment" onClose={() => !isProcessing && setIsPaymentModalOpen(false)}>
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="flex justify-between mb-2"><span className="text-slate-500">Flat Number</span><span className="font-bold text-slate-800">{profile.flatNumber}</span></div>
            <div className="flex justify-between mb-2"><span className="text-slate-500">Resident Name</span><span className="font-bold text-slate-800">{profile.name}</span></div>
            <div className="flex justify-between mb-2"><span className="text-slate-500">For Month</span><span className="font-bold text-slate-800">{currentMonthStr}</span></div>
            <div className="flex justify-between mt-4 pt-4 border-t border-slate-200"><span className="text-slate-700 font-medium">Total Amount Payable</span><span className="text-2xl font-bold text-blue-600">₹{settings.maintenanceAmount}</span></div>
          </div>
          <div className="pt-2 space-y-4">
            {!isBankConfigured && (<p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">Admin has not set the apartment Bank Details yet.</p>)}
            <a href={upiString} className={`w-full py-3 rounded-lg font-bold text-white transition-all flex items-center justify-center shadow-md ${!isBankConfigured ? 'bg-slate-400 pointer-events-none' : 'bg-green-600 hover:bg-green-700'}`}>Pay to WHITE PALACE ASSOCIATION</a>
            <div className="border-t border-slate-200 pt-4 mt-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Step 2: Enter Transaction ID (UTR)</label>
              <p className="text-xs text-slate-500 mb-2">After paying in your UPI app, enter the 12-digit UTR number here.</p>
              <input type="text" placeholder="e.g. 301234567890" className="w-full p-3 border border-slate-300 rounded-lg mb-3" value={utrNumber} onChange={(e) => setUtrNumber(e.target.value)} />
              <button onClick={handlePayment} disabled={isProcessing || !isBankConfigured} className={`w-full py-3 rounded-lg font-bold text-white transition-all flex items-center justify-center ${isProcessing || !isBankConfigured ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md'}`}>{isProcessing ? 'Processing...' : `Submit Payment Record`}</button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const LedgerView = ({ profile, ledgerStats, showToast, getCollectionRef }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], type: 'Expense', description: '', amount: '' });
  const handleAddEntry = async (e) => {
    e.preventDefault();
    try {
      await addDoc(getCollectionRef('ledger'), { ...formData, amount: Number(formData.amount), timestamp: new Date(formData.date).getTime(), createdByAdmin: true });
      showToast("Ledger entry added successfully."); setIsAddModalOpen(false); setFormData({ date: new Date().toISOString().split('T')[0], type: 'Expense', description: '', amount: '' });
    } catch (err) { showToast("Error adding entry.", "error"); }
  };
  return (
    <div className="relative">
      <div className="sticky top-0 bg-white/95 backdrop-blur-sm shadow-sm border border-slate-200 rounded-xl p-4 mb-6 z-10 grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="text-center md:border-r border-slate-200"><p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Net Balance</p><p className="text-xl font-bold text-blue-600">₹{ledgerStats.netBalance}</p></div>
        <div className="text-center md:border-r border-slate-200 hidden md:block"><p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Total Income</p><p className="text-lg font-bold text-green-600">₹{ledgerStats.totalIncome}</p></div>
        <div className="text-center md;border-r border-slate-200 hidden md:block"><p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Total Expense</p><p className="text-lg font-bold text-red-600">₹{ledgerStats.totalExpense}</p></div>
        <div className="text-center md:border-r border-slate-200"><p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Month Income</p><p className="text-lg font-bold text-green-600">₹{ledgerStats.monthlyIncome}</p></div>
        <div className="text-center"><p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Month Expense</p><p className="text-lg font-bold text-red-600">₹{ledgerStats.monthlyExpense}</p></div>
      </div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-slate-800">Financial Ledger</h2>
        {profile.role === 'Admin' && (<button onClick={() => setIsAddModalOpen(true)} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center shadow-sm"><Plus size={16} className="mr-1" /> Add Entry</button>)}
      </div>
      <div className="bg-white border border-slate-300 shadow-sm rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-xs border-b-2 border-slate-300">
              <tr><th className="p-3 border-r border-slate-200">Date</th><th className="p-3 border-r border-slate-200">Description</th><th className="p-3 border-r border-slate-200">Ref / Flat</th><th className="p-3 border-r border-slate-200 text-right">Income (₹)</th><th className="p-3 border-r border-slate-200 text-right">Expense (₹)</th><th className="p-3 text-right bg-blue-50">Balance (₹)</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {ledgerStats.processedLedger.length === 0 ? (<tr><td colSpan="6" className="p-6 text-center text-slate-500">No ledger entries yet.</td></tr>) : (ledgerStats.processedLedger.map((entry) => (<tr key={entry.id} className="hover:bg-slate-50"><td className="p-3 border-r border-slate-200 whitespace-nowrap text-slate-600">{entry.date}</td><td className="p-3 border-r border-slate-200 text-slate-800">{entry.description}</td><td className="p-3 border-r border-slate-200 text-slate-600">{entry.flatNumber || '-'}</td><td className="p-3 border-r border-slate-200 text-right font-medium text-green-600 bg-green-50/30">{entry.type === 'Income' ? entry.amount : ''}</td><td className="p-3 border-r border-slate-200 text-right font-medium text-red-600 bg-red-50/30">{entry.type === 'Expense' ? entry.amount : ''}</td><td className="p-3 text-right font-bold text-slate-800 bg-blue-50/50">{entry.runningBalance}</td></tr>)))}
            </tbody>
          </table>
        </div>
      </div>
      <Modal isOpen={isAddModalOpen} title="Add Ledger Entry" onClose={() => setIsAddModalOpen(false)}>
        <form onSubmit={handleAddEntry} className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Date</label><input required type="date" className="w-full p-2 border rounded-md" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Type</label><select className="w-full p-2 border rounded-md" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}><option value="Income">Income</option><option value="Expense">Expense</option></select></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Description</label><input required type="text" className="w-full p-2 border rounded-md" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹)</label><input required type="number" min="1" className="w-full p-2 border rounded-md" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} /></div>
          <button type="submit" className="w-full bg-slate-800 text-white p-2 rounded-md font-medium mt-4 hover:bg-slate-900">Save Entry</button>
        </form>
      </Modal>
    </div>
  );
};

const AnnouncementsView = ({ profile, announcements, showToast, getCollectionRef }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({ title: '', message: '' });
  const sortedAnnouncements = [...announcements].sort((a, b) => b.timestamp - a.timestamp);
  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await addDoc(getCollectionRef('announcements'), { ...formData, date: new Date().toLocaleDateString(), timestamp: Date.now(), createdByAdmin: profile.name });
      showToast("Announcement published."); setIsAddModalOpen(false); setFormData({ title: '', message: '' });
    } catch (err) { showToast("Error publishing.", "error"); }
  };
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-slate-800">Notice Board</h2>{profile.role === 'Admin' && (<button onClick={() => setIsAddModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center shadow-sm hover:bg-blue-700"><Plus size={16} className="mr-1" /> New Notice</button>)}</div>
      <div className="space-y-4">
        {sortedAnnouncements.length === 0 ? (<div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500">No announcements yet.</div>) : (sortedAnnouncements.map(notice => (<div key={notice.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden"><div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div><h3 className="text-lg font-bold text-slate-800">{notice.title}</h3><p className="text-xs text-slate-500 mb-3">{notice.date} • By {notice.createdByAdmin}</p><p className="text-slate-700 whitespace-pre-wrap">{notice.message}</p></div>)))}
      </div>
      <Modal isOpen={isAddModalOpen} title="Post Announcement" onClose={() => setIsAddModalOpen(false)}>
        <form onSubmit={handleAdd} className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Notice Title</label><input required type="text" className="w-full p-2 border rounded-md" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Message</label><textarea required rows={5} className="w-full p-2 border rounded-md resize-none" value={formData.message} onChange={e => setFormData({ ...formData, message: e.target.value })}></textarea></div>
          <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded-md font-medium mt-4 hover:bg-blue-700">Publish to All</button>
        </form>
      </Modal>
    </div>
  );
};

const MessagesView = ({ profile, messages, showToast, getCollectionRef }) => {
  const [formData, setFormData] = useState('');
  const visibleMessages = profile.role === 'Admin' ? messages : messages.filter(m => m.residentUID === profile.uid);
  const sortedMessages = [...visibleMessages].sort((a, b) => b.timestamp - a.timestamp);
  const handleSend = async (e) => {
    e.preventDefault();
    if (!formData.trim()) return;
    try {
      await addDoc(getCollectionRef('messages'), { residentUID: profile.uid, flatNumber: profile.flatNumber, senderName: profile.name, message: formData, status: 'Open', date: new Date().toLocaleString(), timestamp: Date.now() });
      setFormData(''); showToast("Message sent to management.");
    } catch (err) { showToast("Failed to send.", "error"); }
  };
  return (
    <div className="space-y-6 max-w-4xl mx-auto h-[80vh] flex flex-col">
      <h2 className="text-2xl font-bold text-slate-800 shrink-0">Help & Support</h2>
      <div className="flex-1 overflow-y-auto bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-4">
        {sortedMessages.length === 0 ? (<div className="text-center text-slate-500 mt-10">No messages found.</div>) : (sortedMessages.map(msg => (<div key={msg.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200"><div className="flex justify-between items-start mb-2"><div><span className="font-bold text-slate-800">{msg.senderName}</span><span className="text-xs text-slate-500 ml-2">Flat {msg.flatNumber}</span></div><span className={`text-xs px-2 py-1 rounded-full ${msg.status === 'Open' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>{msg.status}</span></div><p className="text-slate-700">{msg.message}</p><p className="text-xs text-slate-400 mt-2">{msg.date}</p></div>)))}
      </div>
      {profile.role !== 'Admin' && (<form onSubmit={handleSend} className="shrink-0 flex gap-2"><input type="text" placeholder="Type your message..." className="flex-1 p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" value={formData} onChange={e => setFormData(e.target.value)} /><button type="submit" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">Send</button></form>)}
    </div>
  );
};

const ContactsView = ({ profile, contacts, showToast, getCollectionRef }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', designation: '', phoneNumber: '' });
  const handleAdd = async (e) => {
    e.preventDefault();
    try { await addDoc(getCollectionRef('contacts'), formData); showToast("Contact added."); setIsAddModalOpen(false); setFormData({ name: '', designation: '', phoneNumber: '' }); }
    catch (err) { showToast("Error adding contact.", "error"); }
  };
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-slate-800">Management Contacts</h2>{profile.role === 'Admin' && (<button onClick={() => setIsAddModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center"><Plus size={16} className="mr-1" /> Add Contact</button>)}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {contacts.map(contact => (<div key={contact.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between"><div><p className="text-sm font-medium text-blue-600 uppercase tracking-wide">{contact.designation}</p><h3 className="text-lg font-bold text-slate-800">{contact.name}</h3><p className="text-slate-500">{contact.phoneNumber}</p></div><a href={`tel:${contact.phoneNumber}`} className="p-3 bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors"><Phone size={20} /></a></div>))}
        {contacts.length === 0 && <p className="text-slate-500 col-span-2">No contacts listed yet.</p>}
      </div>
      <Modal isOpen={isAddModalOpen} title="Add Contact" onClose={() => setIsAddModalOpen(false)}>
        <form onSubmit={handleAdd} className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Designation</label><input required type="text" className="w-full p-2 border rounded-md" value={formData.designation} onChange={e => setFormData({ ...formData, designation: e.target.value })} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Name</label><input required type="text" className="w-full p-2 border rounded-md" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label><input required type="tel" className="w-full p-2 border rounded-md" value={formData.phoneNumber} onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} /></div>
          <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded-md font-medium mt-4 hover:bg-blue-700">Save Contact</button>
        </form>
      </Modal>
    </div>
  );
};

const SettingsView = ({ settings, showToast, getCollectionRef }) => {
  const [formData, setFormData] = useState({ maintenanceAmount: settings.maintenanceAmount || 1200, accountName: settings.accountName || '', accountNumber: settings.accountNumber || '', ifscCode: settings.ifscCode || '', upiId: settings.upiId || '' });
  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await setDoc(doc(getCollectionRef('settings'), 'global'), { maintenanceAmount: Number(formData.maintenanceAmount), accountName: formData.accountName, accountNumber: formData.accountNumber, ifscCode: formData.ifscCode.toUpperCase(), upiId: formData.upiId, currency: 'INR', lastUpdated: Date.now() }, { merge: true });
      showToast("Settings updated successfully.");
    } catch (err) { showToast("Error saving settings.", "error"); }
  };
  return (
    <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center"><Settings className="mr-2" /> Global Settings</h2>
      <form onSubmit={handleSave} className="space-y-6">
        <div><label className="block text-sm font-bold text-slate-700 mb-2">Monthly Maintenance Amount (₹)</label><input required type="number" min="0" className="w-full p-3 border border-slate-300 rounded-lg text-lg" value={formData.maintenanceAmount} onChange={e => setFormData({ ...formData, maintenanceAmount: e.target.value })} /></div>
        <div className="pt-4 border-t border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Bank Account Details (For GPay Auto-Pay)</h3>
          <div className="space-y-4">
            <div><label className="block text-sm font-bold text-slate-700 mb-1">Account Holder Name</label><input required type="text" className="w-full p-3 border border-slate-300 rounded-lg" value={formData.accountName} onChange={e => setFormData({ ...formData, accountName: e.target.value })} /></div>
            <div><label className="block text-sm font-bold text-slate-700 mb-1">UPI ID (Optional)</label><input type="text" className="w-full p-3 border border-slate-300 rounded-lg" value={formData.upiId} onChange={e => setFormData({ ...formData, upiId: e.target.value })} placeholder="e.g. email@bank" /></div>
            <div><label className="block text-sm font-bold text-slate-700 mb-1">Bank Account Number</label><input type="text" className="w-full p-3 border border-slate-300 rounded-lg font-mono" value={formData.accountNumber} onChange={e => setFormData({ ...formData, accountNumber: e.target.value })} /></div>
            <div><label className="block text-sm font-bold text-slate-700 mb-1">IFSC Code</label><input type="text" className="w-full p-3 border border-slate-300 rounded-lg font-mono uppercase" value={formData.ifscCode} onChange={e => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })} /></div>
          </div>
        </div>
        <button type="submit" className="bg-slate-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-900 transition-colors">Update Settings</button>
      </form>
    </div>
  );
};

const DirectoryView = ({ profiles, payments, showToast, getCollectionRef }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', flatNumber: '', phone: '', role: 'Owner' });
  const handleAddResident = async (e) => {
    e.preventDefault();
    try {
      const tempUid = 'manual_' + Date.now();
      await setDoc(doc(getCollectionRef('profiles'), tempUid), { uid: tempUid, ...formData, createdAt: Date.now() });
      showToast(`Added Flat ${formData.flatNumber} successfully.`); setIsAddModalOpen(false); setFormData({ name: '', flatNumber: '', phone: '', role: 'Owner' });
    } catch (err) { showToast("Failed to add resident.", "error"); }
  };
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-slate-800">Resident Directory</h2><button onClick={() => setIsAddModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center shadow-sm"><Plus size={16} className="mr-1" /> Add Resident</button></div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200"><tr><th className="p-4">Flat No.</th><th className="p-4">Name</th><th className="p-4">Role</th><th className="p-4">Contact</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {profiles.map(p => (<tr key={p.id} className="hover:bg-slate-50"><td className="p-4 font-bold text-slate-800">{p.flatNumber}</td><td className="p-4 text-slate-700">{p.name}</td><td className="p-4"><span className={`px-2 py-1 rounded text-xs font-medium ${p.role === 'Admin' ? 'bg-purple-100 text-purple-800' : p.role === 'Tenant' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>{p.role}</span></td><td className="p-4 text-slate-600">{p.phone}</td></tr>))}
              {profiles.length === 0 && (<tr><td colSpan="4" className="p-8 text-center text-slate-500">No residents added yet.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
      <Modal isOpen={isAddModalOpen} title="Add New Resident" onClose={() => setIsAddModalOpen(false)}>
        <form onSubmit={handleAddResident} className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Flat Number</label><input required type="text" className="w-full p-3 border border-slate-300 rounded-lg uppercase" value={formData.flatNumber} onChange={e => setFormData({ ...formData, flatNumber: e.target.value.toUpperCase() })} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Name</label><input required type="text" className="w-full p-3 border border-slate-300 rounded-lg" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Phone</label><input required type="tel" className="w-full p-3 border border-slate-300 rounded-lg" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Role</label><select className="w-full p-3 border border-slate-300 rounded-lg" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}><option value="Owner">Resident (Owner)</option><option value="Tenant">Tenant</option></select></div>
          <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-lg font-medium mt-4 hover:bg-blue-700">Save</button>
        </form>
      </Modal>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color }) => {
  const colorMap = { blue: 'bg-blue-50 text-blue-600 border-blue-200', green: 'bg-green-50 text-green-600 border-green-200', red: 'bg-red-50 text-red-600 border-red-200', purple: 'bg-purple-50 text-purple-600 border-purple-200' };
  return (
    <div className={`p-6 rounded-xl border ${colorMap[color]} shadow-sm flex items-center justify-between`}>
      <div><p className="text-sm font-semibold opacity-80 uppercase tracking-wide">{title}</p><p className="text-2xl font-bold mt-1 text-slate-800">{value}</p></div>
      <div className="p-3 bg-white/50 rounded-full"><Icon size={24} /></div>
    </div>
  );
};
