import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  Settings,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  CreditCard,
  Banknote,
  Smartphone,
  Trash2,
  Edit3,
  CheckCircle2,
  XCircle,
  Download,
  Upload,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Database,
  Cloud,
  Barcode,
  Printer,
  ChevronRight,
  Store,
  Bell,
  Menu,
  X,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  FileText,
  UserPlus,
  PackagePlus,
  Layers,
  Tag,
  Clock,
  Check
} from 'lucide-react';

const appId = typeof __app_id !== 'undefined' ? __app_id : 'stitch-inventario-comercial';
const firebaseConfig = typeof __firebase_config !== 'undefined'
  ? JSON.parse(__firebase_config)
  : { apiKey: '', authDomain: '', projectId: '' };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const INITIAL_PRODUCTS = [
  {
    id: 'prod-101',
    sku: 'TEC-MON-001',
    barcode: '7501031311309',
    name: 'Monitor UltraWide 34" IPS Curvo',
    category: 'Electrónica',
    costPrice: 310.00,
    salePrice: 449.99,
    stock: 14,
    minStock: 5,
    unit: 'Unidad',
    supplier: 'TechGlobal Distribuciones',
    location: 'Pasillo A - Estante 2',
    status: 'active',
    imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=500&q=80',
    updatedAt: Date.now() - 86400000 * 3
  },
  {
    id: 'prod-102',
    sku: 'TEC-TEC-002',
    barcode: '7501031311316',
    name: 'Teclado Mecánico Inalámbrico RGB Pro',
    category: 'Accesorios',
    costPrice: 55.00,
    salePrice: 95.00,
    stock: 4,
    minStock: 8,
    unit: 'Unidad',
    supplier: 'KeyMaster Corp',
    location: 'Pasillo B - Estante 1',
    status: 'active',
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=500&q=80',
    updatedAt: Date.now() - 86400000 * 2
  },
  {
    id: 'prod-103',
    sku: 'AUD-SNY-003',
    barcode: '7501031311323',
    name: 'Auriculares Noise Cancelling Studio',
    category: 'Audio',
    costPrice: 140.00,
    salePrice: 229.50,
    stock: 22,
    minStock: 6,
    unit: 'Unidad',
    supplier: 'SoundWave Latam',
    location: 'Vitrina Principal 1',
    status: 'active',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=500&q=80',
    updatedAt: Date.now() - 86400000
  },
  {
    id: 'prod-104',
    sku: 'MOB-SIL-004',
    barcode: '7501031311330',
    name: 'Silla Ergonómica Ejecutiva Lumbar',
    category: 'Mobiliario',
    costPrice: 125.00,
    salePrice: 199.00,
    stock: 3,
    minStock: 5,
    unit: 'Unidad',
    supplier: 'ConfortOffice S.A.',
    location: 'Almacén Central B4',
    status: 'active',
    imageUrl: 'https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=500&q=80',
    updatedAt: Date.now() - 3600000 * 12
  },
  {
    id: 'prod-105',
    sku: 'ACC-HUB-005',
    barcode: '7501031311347',
    name: 'Hub USB-C 10 en 1 Aluminio 4K',
    category: 'Accesorios',
    costPrice: 24.00,
    salePrice: 49.90,
    stock: 38,
    minStock: 10,
    unit: 'Unidad',
    supplier: 'TechGlobal Distribuciones',
    location: 'Pasillo B - Gaveta 4',
    status: 'active',
    imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=500&q=80',
    updatedAt: Date.now() - 3600000 * 5
  },
  {
    id: 'prod-106',
    sku: 'CAM-WEB-006',
    barcode: '7501031311354',
    name: 'Cámara Web 4K Ultra HD AutoFocus',
    category: 'Electrónica',
    costPrice: 48.00,
    salePrice: 89.00,
    stock: 0,
    minStock: 6,
    unit: 'Unidad',
    supplier: 'OpticVision',
    location: 'Pasillo A - Estante 4',
    status: 'out_of_stock',
    imageUrl: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=500&q=80',
    updatedAt: Date.now() - 3600000 * 2
  },
  {
    id: 'prod-107',
    sku: 'POS-IMP-007',
    barcode: '7501031311361',
    name: 'Impresora Térmica de Tickets 80mm LAN/USB',
    category: 'Punto de Venta',
    costPrice: 68.00,
    salePrice: 119.00,
    stock: 11,
    minStock: 4,
    unit: 'Unidad',
    supplier: 'RetailPos Hardware',
    location: 'Pasillo C - Estante 1',
    status: 'active',
    imageUrl: 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?auto=format&fit=crop&w=500&q=80',
    updatedAt: Date.now() - 3600000
  },
  {
    id: 'prod-108',
    sku: 'POS-ESC-008',
    barcode: '7501031311378',
    name: 'Lector Código de Barras 2D/QR Inalámbrico',
    category: 'Punto de Venta',
    costPrice: 32.00,
    salePrice: 64.50,
    stock: 19,
    minStock: 5,
    unit: 'Unidad',
    supplier: 'RetailPos Hardware',
    location: 'Pasillo C - Estante 2',
    status: 'active',
    imageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=500&q=80',
    updatedAt: Date.now()
  }
];

const INITIAL_STAFF = [
  {
    id: 'usr-01',
    name: 'Carlos Mendoza',
    email: 'cmendoza@stitchretail.com',
    role: 'Administrador',
    branch: 'Sucursal Central Madrid',
    phone: '+34 612 345 678',
    status: 'Activo',
    shift: 'Mañana / Completo',
    permissions: ['pos', 'inventory', 'staff', 'reports', 'settings'],
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    lastAccess: 'Hace 5 min'
  },
  {
    id: 'usr-02',
    name: 'Laura Gómez',
    email: 'lgomez@stitchretail.com',
    role: 'Cajero',
    branch: 'Sucursal Central Madrid',
    phone: '+34 698 112 233',
    status: 'Activo',
    shift: 'Mañana (08:00 - 16:00)',
    permissions: ['pos', 'inventory'],
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    lastAccess: 'En turno (POS #1)'
  },
  {
    id: 'usr-03',
    name: 'Javier Ruiz',
    email: 'jruiz@stitchretail.com',
    role: 'Almacenista',
    branch: 'Almacén Logístico Norte',
    phone: '+34 644 556 778',
    status: 'Activo',
    shift: 'Tarde (14:00 - 22:00)',
    permissions: ['inventory', 'reports'],
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    lastAccess: 'Hace 2 horas'
  },
  {
    id: 'usr-04',
    name: 'Elena Torres',
    email: 'etorres@stitchretail.com',
    role: 'Gerente',
    branch: 'Sucursal Central Madrid',
    phone: '+34 677 889 900',
    status: 'Vacaciones',
    shift: 'Completo',
    permissions: ['pos', 'inventory', 'staff', 'reports'],
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80',
    lastAccess: 'Hace 3 días'
  }
];

const INITIAL_SALES = [
  {
    id: 'VTA-8901',
    receiptNumber: 'FAC-2026-0891',
    cashier: 'Laura Gómez',
    customerName: 'Cliente Mostrador',
    paymentMethod: 'Tarjeta',
    items: [
      { id: 'prod-101', name: 'Monitor UltraWide 34" IPS Curvo', qty: 1, price: 449.99, cost: 310.00 },
      { id: 'prod-105', name: 'Hub USB-C 10 en 1 Aluminio 4K', qty: 2, price: 49.90, cost: 24.00 }
    ],
    subtotal: 454.37,
    tax: 95.42,
    discount: 0,
    total: 549.79,
    profit: 191.79,
    createdAt: Date.now() - 3600000 * 6
  },
  {
    id: 'VTA-8902',
    receiptNumber: 'FAC-2026-0892',
    cashier: 'Carlos Mendoza',
    customerName: 'Estudio Creativo Pixel S.L.',
    paymentMethod: 'Transferencia',
    items: [
      { id: 'prod-103', name: 'Auriculares Noise Cancelling Studio', qty: 2, price: 229.50, cost: 140.00 },
      { id: 'prod-102', name: 'Teclado Mecánico Inalámbrico RGB Pro', qty: 2, price: 95.00, cost: 55.00 }
    ],
    subtotal: 536.36,
    tax: 112.64,
    discount: 0,
    total: 649.00,
    profit: 259.00,
    createdAt: Date.now() - 3600000 * 2
  },
  {
    id: 'VTA-8903',
    receiptNumber: 'FAC-2026-0893',
    cashier: 'Laura Gómez',
    customerName: 'María Fernanda Solís',
    paymentMethod: 'Efectivo',
    items: [
      { id: 'prod-108', name: 'Lector Código de Barras 2D/QR Inalámbrico', qty: 1, price: 64.50, cost: 32.00 }
    ],
    subtotal: 53.31,
    tax: 11.19,
    discount: 0,
    total: 64.50,
    profit: 32.50,
    createdAt: Date.now() - 1800000
  }
];

const DEFAULT_SETTINGS = {
  storeName: 'Stitch Comercial & POS',
  legalName: 'Stitch Retail Technologies S.L.',
  taxId: 'B-89234112',
  currencySymbol: '€',
  currencyCode: 'EUR',
  taxRate: 21,
  lowStockDefault: 5,
  address: 'Av. de la Castellana 142, Madrid, España',
  phone: '+34 910 234 567',
  email: 'contacto@stitchretail.com',
  receiptFooter: '¡Gracias por su compra! Conserva este ticket para garantías (30 días).',
  autoDeductStock: true,
  allowNegativeStock: false,
  enableBarcodeBeep: true
};

const compressImageFile = (file, maxWidth = 480, quality = 0.72) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function App() {
  // Auth & Firebase states
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('connecting'); // connecting | synced | error
  const [activeOperator, setActiveOperator] = useState('Carlos Mendoza (Admin)');

  // Navigation state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Firestore synced collections
  const [products, setProducts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [sales, setSales] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [hasSeeded, setHasSeeded] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState(null);

  // Modal states
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [receiptModalSale, setReceiptModalSale] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Inventory filter states
  const [invSearch, setInvSearch] = useState('');
  const [invCategory, setInvCategory] = useState('Todas');
  const [invStockFilter, setInvStockFilter] = useState('all'); // all | low | out | ok

  // POS terminal states
  const [posSearch, setPosSearch] = useState('');
  const [posCategory, setPosCategory] = useState('Todas');
  const [cart, setCart] = useState([]);
  const [posCustomer, setPosCustomer] = useState('Cliente Mostrador');
  const [posPaymentMethod, setPosPaymentMethod] = useState('Tarjeta');
  const [posDiscountPct, setPosDiscountPct] = useState(0);
  const [posCashReceived, setPosCashReceived] = useState('');
  const [isProcessingSale, setIsProcessingSale] = useState(false);

  // Staff filter state
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState('Todos');

  // Product Form State
  const [productForm, setProductForm] = useState({
    sku: '',
    barcode: '',
    name: '',
    category: 'Electrónica',
    costPrice: '',
    salePrice: '',
    stock: '',
    minStock: 5,
    unit: 'Unidad',
    supplier: '',
    location: '',
    imageUrl: ''
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  // Staff Form State
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    role: 'Cajero',
    branch: 'Sucursal Central Madrid',
    phone: '',
    status: 'Activo',
    shift: 'Mañana (08:00 - 16:00)',
    permissions: ['pos', 'inventory'],
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
  });

  const showToast = (message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => {
      setToast((prev) => (prev && prev.message === message ? null : prev));
    }, 3800);
  };

  // RULE 3: Auth Before Queries
  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error('Error en autenticación Firebase:', err);
        if (isMounted) setSyncStatus('error');
      }
    };

    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (isMounted) {
        setUser(currentUser);
        setAuthLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    setSyncStatus('connecting');

    // RULE 1: Strict Paths under /artifacts/{appId}/public/data/{collectionName}
    const productsRef = collection(db, 'artifacts', appId, 'public', 'data', 'products');
    const staffRef = collection(db, 'artifacts', appId, 'public', 'data', 'staff');
    const salesRef = collection(db, 'artifacts', appId, 'public', 'data', 'sales');
    const settingsRef = collection(db, 'artifacts', appId, 'public', 'data', 'settings');

    const unsubProducts = onSnapshot(
      productsRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        setProducts(list);
        setSyncStatus('synced');
      },
      (err) => {
        console.error('Error leyendo productos:', err);
        setSyncStatus('error');
      }
    );

    const unsubStaff = onSnapshot(
      staffRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setStaff(list);
      },
      (err) => console.error('Error leyendo personal:', err)
    );

    const unsubSales = onSnapshot(
      salesRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setSales(list);
      },
      (err) => console.error('Error leyendo ventas:', err)
    );

    const unsubSettings = onSnapshot(
      settingsRef,
      (snapshot) => {
        const configDoc = snapshot.docs.find((d) => d.id === 'store_config');
        if (configDoc) {
          setSettings({ ...DEFAULT_SETTINGS, ...configDoc.data() });
        }
      },
      (err) => console.error('Error leyendo configuración:', err)
    );

    return () => {
      unsubProducts();
      unsubStaff();
      unsubSales();
      unsubSettings();
    };
  }, [user]);

  const seedDatabaseIfNeeded = async (force = false) => {
    if (!user) return;
    try {
      setSyncStatus('connecting');
      for (const prod of INITIAL_PRODUCTS) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', prod.id), prod);
      }
      for (const member of INITIAL_STAFF) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'staff', member.id), member);
      }
      for (const sale of INITIAL_SALES) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sales', sale.id), sale);
      }
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'store_config'),
        DEFAULT_SETTINGS
      );
      setHasSeeded(true);
      setSyncStatus('synced');
      if (force) {
        showToast('Base de datos Firebase restaurada con datos comerciales de demostración');
      }
    } catch (error) {
      console.error('Error inicializando datos:', error);
      showToast('Error al sincronizar datos iniciales con Firebase', 'error');
    }
  };

  useEffect(() => {
    if (user && !authLoading && products.length === 0 && staff.length === 0 && !hasSeeded) {
      const timer = setTimeout(() => {
        if (products.length === 0) {
          seedDatabaseIfNeeded(false);
        }
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [user, authLoading, products.length, staff.length, hasSeeded]);

  const categories = useMemo(() => {
    const set = new Set(['Electrónica', 'Accesorios', 'Audio', 'Mobiliario', 'Punto de Venta']);
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['Todas', ...Array.from(set)];
  }, [products]);

  const kpis = useMemo(() => {
    const totalInventoryValue = products.reduce(
      (acc, p) => acc + (Number(p.salePrice) || 0) * (Number(p.stock) || 0),
      0
    );
    const totalInventoryCost = products.reduce(
      (acc, p) => acc + (Number(p.costPrice) || 0) * (Number(p.stock) || 0),
      0
    );
    const totalUnits = products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
    const lowStockItems = products.filter(
      (p) => Number(p.stock) > 0 && Number(p.stock) <= Number(p.minStock || settings.lowStockDefault)
    );
    const outOfStockItems = products.filter((p) => Number(p.stock) <= 0);

    const totalRevenue = sales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    const totalProfit = sales.reduce((acc, s) => acc + (Number(s.profit) || 0), 0);

    return {
      totalInventoryValue,
      totalInventoryCost,
      totalUnits,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      lowStockItems,
      outOfStockItems,
      totalRevenue,
      totalProfit,
      salesCount: sales.length
    };
  }, [products, sales, settings.lowStockDefault]);

  const formatMoney = (amount) => {
    const num = Number(amount) || 0;
    return `${settings.currencySymbol}${num.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const openNewProductModal = () => {
    setEditingProduct(null);
    const randomCode = Math.floor(100000000000 + Math.random() * 900000000000);
    setProductForm({
      sku: `PRD-${Math.floor(100 + Math.random() * 900)}`,
      barcode: `7${randomCode}`,
      name: '',
      category: 'Electrónica',
      costPrice: '',
      salePrice: '',
      stock: 10,
      minStock: settings.lowStockDefault || 5,
      unit: 'Unidad',
      supplier: '',
      location: 'Almacén General',
      imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=500&q=80'
    });
    setProductModalOpen(true);
  };

  const openEditProductModal = (product) => {
    setEditingProduct(product);
    setProductForm({
      sku: product.sku || '',
      barcode: product.barcode || '',
      name: product.name || '',
      category: product.category || 'Electrónica',
      costPrice: product.costPrice ?? '',
      salePrice: product.salePrice ?? '',
      stock: product.stock ?? 0,
      minStock: product.minStock ?? 5,
      unit: product.unit || 'Unidad',
      supplier: product.supplier || '',
      location: product.location || '',
      imageUrl: product.imageUrl || ''
    });
    setProductModalOpen(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingImage(true);
      const compressedDataUrl = await compressImageFile(file);
      setProductForm((prev) => ({ ...prev, imageUrl: compressedDataUrl }));
      showToast('Imagen optimizada y cargada en el almacenamiento de Firebase');
    } catch (error) {
      console.error('Error al procesar imagen:', error);
      showToast('No se pudo procesar la imagen seleccionada', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!productForm.name.trim() || !productForm.sku.trim()) {
      showToast('Por favor completa el nombre y el SKU del producto', 'error');
      return;
    }

    const stockNum = Number(productForm.stock) || 0;
    const payload = {
      sku: productForm.sku.trim().toUpperCase(),
      barcode: productForm.barcode.trim(),
      name: productForm.name.trim(),
      category: productForm.category,
      costPrice: Number(productForm.costPrice) || 0,
      salePrice: Number(productForm.salePrice) || 0,
      stock: stockNum,
      minStock: Number(productForm.minStock) || 5,
      unit: productForm.unit || 'Unidad',
      supplier: productForm.supplier.trim() || 'Proveedor General',
      location: productForm.location.trim() || 'Almacén Principal',
      status: stockNum <= 0 ? 'out_of_stock' : 'active',
      imageUrl:
        productForm.imageUrl.trim() ||
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=500&q=80',
      updatedAt: Date.now()
    };

    try {
      if (editingProduct) {
        await setDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'products', editingProduct.id),
          payload,
          { merge: true }
        );
        showToast(`Producto "${payload.name}" actualizado en Firebase`);
      } else {
        const newId = `prod-${Date.now()}`;
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', newId), {
          id: newId,
          ...payload
        });
        showToast(`Producto "${payload.name}" registrado en el inventario`);
      }
      setProductModalOpen(false);
    } catch (err) {
      console.error('Error guardando producto:', err);
      showToast('Error al guardar en Firebase Firestore', 'error');
    }
  };

  const handleQuickStockAdjust = async (product, delta) => {
    if (!user) return;
    const newStock = Math.max(0, (Number(product.stock) || 0) + delta);
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', product.id), {
        stock: newStock,
        status: newStock <= 0 ? 'out_of_stock' : 'active',
        updatedAt: Date.now()
      });
      showToast(`Stock de ${product.sku} ajustado a ${newStock} unidades`);
    } catch (err) {
      console.error('Error ajustando stock:', err);
      showToast('No se pudo actualizar el stock', 'error');
    }
  };

  const handleDeleteProduct = (product) => {
    setConfirmDialog({
      title: 'Eliminar Producto del Inventario',
      message: `¿Estás seguro de que deseas eliminar permanentemente "${product.name}" (SKU: ${product.sku}) de la base de datos Firebase?`,
      confirmLabel: 'Sí, Eliminar',
      onConfirm: async () => {
        if (!user) return;
        try {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', product.id));
          showToast(`Producto "${product.name}" eliminado`);
        } catch (err) {
          console.error(err);
          showToast('Error eliminando producto', 'error');
        }
        setConfirmDialog(null);
      }
    });
  };

  const addToCart = (product) => {
    const currentStock = Number(product.stock) || 0;
    if (currentStock <= 0 && !settings.allowNegativeStock) {
      showToast(`"${product.name}" está agotado en almacén`, 'error');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        if (existing.qty + 1 > currentStock && !settings.allowNegativeStock) {
          showToast(`Stock máximo disponible alcanzado (${currentStock} uds.)`, 'error');
          return prev;
        }
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          sku: product.sku,
          name: product.name,
          price: Number(product.salePrice) || 0,
          cost: Number(product.costPrice) || 0,
          stock: currentStock,
          imageUrl: product.imageUrl,
          qty: 1
        }
      ];
    });
  };

  const updateCartQty = (id, newQty) => {
    if (newQty <= 0) {
      setCart((prev) => prev.filter((item) => item.id !== id));
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          if (newQty > item.stock && !settings.allowNegativeStock) {
            showToast(`Solo hay ${item.stock} unidades disponibles`, 'error');
            return item;
          }
          return { ...item, qty: newQty };
        }
        return item;
      })
    );
  };

  const cartTotals = useMemo(() => {
    const grossTotal = cart.reduce((acc, item) => acc + item.price * item.qty, 0);
    const totalCost = cart.reduce((acc, item) => acc + item.cost * item.qty, 0);
    const discountAmount = grossTotal * (Math.min(100, Math.max(0, Number(posDiscountPct) || 0)) / 100);
    const finalTotal = Math.max(0, grossTotal - discountAmount);
    const taxRateDecimal = (Number(settings.taxRate) || 21) / 100;
    const subtotal = finalTotal / (1 + taxRateDecimal);
    const tax = finalTotal - subtotal;
    const profit = finalTotal - totalCost;

    return {
      grossTotal,
      discountAmount,
      subtotal,
      tax,
      total: finalTotal,
      profit
    };
  }, [cart, posDiscountPct, settings.taxRate]);

  const handleCheckoutSale = async () => {
    if (!user || cart.length === 0) return;
    setIsProcessingSale(true);

    try {
      const saleId = `VTA-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString().slice(-3)}`;
      const receiptNumber = `FAC-2026-${String(sales.length + 894).padStart(4, '0')}`;

      const saleDoc = {
        id: saleId,
        receiptNumber,
        cashier: activeOperator,
        customerName: posCustomer.trim() || 'Cliente Mostrador',
        paymentMethod: posPaymentMethod,
        items: cart.map((i) => ({
          id: i.id,
          sku: i.sku,
          name: i.name,
          qty: i.qty,
          price: i.price,
          cost: i.cost
        })),
        subtotal: Number(cartTotals.subtotal.toFixed(2)),
        tax: Number(cartTotals.tax.toFixed(2)),
        discount: Number(cartTotals.discountAmount.toFixed(2)),
        total: Number(cartTotals.total.toFixed(2)),
        profit: Number(cartTotals.profit.toFixed(2)),
        createdAt: Date.now()
      };

      // Save sale to Firestore
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sales', saleId), saleDoc);

      // Deduct stock in Firestore if enabled
      if (settings.autoDeductStock) {
        for (const item of cart) {
          const prodInDb = products.find((p) => p.id === item.id);
          if (prodInDb) {
            const updatedStock = Math.max(0, (Number(prodInDb.stock) || 0) - item.qty);
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', item.id), {
              stock: updatedStock,
              status: updatedStock <= 0 ? 'out_of_stock' : 'active',
              updatedAt: Date.now()
            });
          }
        }
      }

      setCart([]);
      setPosDiscountPct(0);
      setPosCashReceived('');
      setReceiptModalSale(saleDoc);
      showToast(`Venta ${receiptNumber} procesada y descontada del inventario`);
    } catch (error) {
      console.error('Error al procesar venta:', error);
      showToast('Error al registrar la venta en Firebase', 'error');
    } finally {
      setIsProcessingSale(false);
    }
  };

  const openNewStaffModal = () => {
    setEditingStaff(null);
    setStaffForm({
      name: '',
      email: '',
      role: 'Cajero',
      branch: 'Sucursal Central Madrid',
      phone: '+34 ',
      status: 'Activo',
      shift: 'Mañana (08:00 - 16:00)',
      permissions: ['pos', 'inventory'],
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'
    });
    setStaffModalOpen(true);
  };

  const openEditStaffModal = (member) => {
    setEditingStaff(member);
    setStaffForm({
      name: member.name || '',
      email: member.email || '',
      role: member.role || 'Cajero',
      branch: member.branch || 'Sucursal Central Madrid',
      phone: member.phone || '',
      status: member.status || 'Activo',
      shift: member.shift || 'Mañana',
      permissions: member.permissions || ['pos'],
      avatar: member.avatar || ''
    });
    setStaffModalOpen(true);
  };

  const toggleStaffPermission = (permKey) => {
    setStaffForm((prev) => {
      const exists = prev.permissions.includes(permKey);
      return {
        ...prev,
        permissions: exists
          ? prev.permissions.filter((p) => p !== permKey)
          : [...prev.permissions, permKey]
      };
    });
  };

  const handleSaveStaff = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!staffForm.name.trim() || !staffForm.email.trim()) {
      showToast('Ingresa el nombre y correo electrónico del usuario', 'error');
      return;
    }

    try {
      const payload = {
        ...staffForm,
        lastAccess: editingStaff ? editingStaff.lastAccess : 'Recién registrado',
        updatedAt: Date.now()
      };

      if (editingStaff) {
        await setDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'staff', editingStaff.id),
          payload,
          { merge: true }
        );
        showToast(`Usuario "${staffForm.name}" actualizado`);
      } else {
        const newId = `usr-${Date.now()}`;
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'staff', newId), {
          id: newId,
          ...payload
        });
        showToast(`Nuevo colaborador "${staffForm.name}" dado de alta en Firebase`);
      }
      setStaffModalOpen(false);
    } catch (error) {
      console.error('Error guardando usuario:', error);
      showToast('Error al guardar el usuario en Firebase', 'error');
    }
  };

  const handleDeleteStaff = (member) => {
    setConfirmDialog({
      title: 'Dar de Baja Usuario',
      message: `¿Deseas eliminar el perfil de "${member.name}" (${member.role}) del sistema?`,
      confirmLabel: 'Eliminar Usuario',
      onConfirm: async () => {
        if (!user) return;
        try {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'staff', member.id));
          showToast(`Usuario "${member.name}" eliminado`);
        } catch (err) {
          console.error(err);
          showToast('Error al eliminar usuario', 'error');
        }
        setConfirmDialog(null);
      }
    });
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'store_config'),
        settings,
        { merge: true }
      );
      showToast('Configuración del inventario sincronizada con Firebase');
    } catch (error) {
      console.error('Error guardando configuración:', error);
      showToast('No se pudo guardar la configuración', 'error');
    }
  };

  const exportInventoryCSV = () => {
    const headers = ['SKU', 'CodigoBarras', 'Nombre', 'Categoria', 'Costo', 'PrecioVenta', 'Stock', 'StockMin', 'Proveedor', 'Ubicacion'];
    const rows = products.map((p) => [
      `"${p.sku || ''}"`,
      `"${p.barcode || ''}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${p.category || ''}"`,
      p.costPrice || 0,
      p.salePrice || 0,
      p.stock || 0,
      p.minStock || 0,
      `"${p.supplier || ''}"`,
      `"${p.location || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `inventario_stitch_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Reporte CSV de inventario descargado');
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesQuery =
        !invSearch.trim() ||
        (p.name || '').toLowerCase().includes(invSearch.toLowerCase()) ||
        (p.sku || '').toLowerCase().includes(invSearch.toLowerCase()) ||
        (p.barcode || '').includes(invSearch.trim());
      const matchesCat = invCategory === 'Todas' || p.category === invCategory;
      const stock = Number(p.stock) || 0;
      const minStock = Number(p.minStock || settings.lowStockDefault);
      let matchesStock = true;
      if (invStockFilter === 'low') matchesStock = stock > 0 && stock <= minStock;
      if (invStockFilter === 'out') matchesStock = stock <= 0;
      if (invStockFilter === 'ok') matchesStock = stock > minStock;
      return matchesQuery && matchesCat && matchesStock;
    });
  }, [products, invSearch, invCategory, invStockFilter, settings.lowStockDefault]);

  const posFilteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesQuery =
        !posSearch.trim() ||
        (p.name || '').toLowerCase().includes(posSearch.toLowerCase()) ||
        (p.sku || '').toLowerCase().includes(posSearch.toLowerCase()) ||
        (p.barcode || '').includes(posSearch.trim());
      const matchesCat = posCategory === 'Todas' || p.category === posCategory;
      return matchesQuery && matchesCat;
    });
  }, [products, posSearch, posCategory]);

  const filteredStaff = useMemo(() => {
    return staff.filter((m) => {
      const matchesSearch =
        !staffSearch.trim() ||
        (m.name || '').toLowerCase().includes(staffSearch.toLowerCase()) ||
        (m.email || '').toLowerCase().includes(staffSearch.toLowerCase());
      const matchesRole = staffRoleFilter === 'Todos' || m.role === staffRoleFilter;
      return matchesSearch && matchesRole;
    });
  }, [staff, staffSearch, staffRoleFilter]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard General', icon: LayoutDashboard },
    { id: 'pos', label: 'Terminal POS', icon: ShoppingCart, badge: cart.length > 0 ? cart.reduce((a, b) => a + b.qty, 0) : null },
    { id: 'inventory', label: 'Inventario y Stock', icon: Package, badge: kpis.lowStockCount + kpis.outOfStockCount || null },
    { id: 'staff', label: 'Personal y Usuarios', icon: Users },
    { id: 'reports', label: 'Reportes y Analíticas', icon: BarChart3 },
    { id: 'settings', label: 'Configuración', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row font-sans selection:bg-indigo-500 selection:text-white">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md transition-all duration-300 bg-slate-900/95 border-indigo-500/40 text-white">
          {toast.type === 'error' ? (
            <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-white block leading-none">
              {settings.storeName}
            </span>
            <span className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Firebase Cloud Activo
            </span>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`${
          mobileMenuOpen ? 'fixed inset-0 z-40 block bg-slate-950/95 pt-16' : 'hidden'
        } md:flex md:flex-col md:w-64 lg:w-72 bg-slate-900/80 border-r border-slate-800/80 shrink-0 justify-between`}
      >
        <div>
          {/* Brand Logo */}
          <div className="hidden md:flex items-center gap-3 px-6 py-5 border-b border-slate-800/80">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div className="overflow-hidden">
              <h1 className="font-bold text-base tracking-tight text-white truncate">
                {settings.storeName}
              </h1>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Cloud className="w-3.5 h-3.5 text-indigo-400" />
                <span>Firebase Suite v3.4</span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="p-3.5 space-y-1">
            <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Módulos del Sistema
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                      : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
                        isActive
                          ? 'bg-white text-indigo-700'
                          : item.id === 'inventory'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-indigo-500/20 text-indigo-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Firebase Status & Active User Footer */}
        <div className="p-4 border-t border-slate-800/80 space-y-3 bg-slate-900/40">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                Firestore DB
              </span>
              <span
                className={`flex items-center gap-1 font-medium ${
                  syncStatus === 'synced'
                    ? 'text-emerald-400'
                    : syncStatus === 'connecting'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    syncStatus === 'synced'
                      ? 'bg-emerald-400'
                      : syncStatus === 'connecting'
                      ? 'bg-amber-400 animate-ping'
                      : 'bg-rose-400'
                  }`}
                />
                {syncStatus === 'synced'
                  ? 'Sincronizado'
                  : syncStatus === 'connecting'
                  ? 'Conectando...'
                  : 'Error'}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 truncate" title={user?.uid || 'Autenticando'}>
              UID: <span className="font-mono text-slate-300">{user?.uid || 'Iniciando sesión...'}</span>
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-xs shrink-0">
                CM
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">{activeOperator}</p>
                <p className="text-[11px] text-slate-400 truncate">Sucursal Madrid</p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('settings')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              title="Configuración de Cuenta y Firebase"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Desktop Header */}
        <header className="hidden md:flex items-center justify-between px-8 py-4 bg-slate-900/50 border-b border-slate-800/80 backdrop-blur-sm sticky top-0 z-20">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              {navItems.find((n) => n.id === activeTab)?.label}
            </h2>
            <p className="text-xs text-slate-400">
              {settings.legalName} • {settings.address}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Operator Switcher */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <select
                value={activeOperator}
                onChange={(e) => {
                  setActiveOperator(e.target.value);
                  showToast(`Operador activo cambiado a ${e.target.value}`);
                }}
                className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
              >
                {staff.map((m) => (
                  <option key={m.id} value={`${m.name} (${m.role})`} className="bg-slate-900 text-white">
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setActiveTab('pos')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 text-xs font-semibold transition"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Ir a Caja POS</span>
            </button>

            <button
              onClick={openNewProductModal}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Producto</span>
            </button>
          </div>
        </header>

        {/* Module Content Switcher */}
        <div className="flex-1 p-4 md:p-8 space-y-6">
          {/* ==========================================
              MODULE 1: DASHBOARD GENERAL
          ========================================== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Top Welcome Banner */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/90 via-slate-900 to-slate-900 border border-indigo-500/30 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-medium">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Sincronización Cloud en Tiempo Real</span>
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-white mt-1">
                    Panel de Control de Inventario Comercial
                  </h3>
                  <p className="text-sm text-slate-400 max-w-2xl">
                    Gestiona existencias, procesa ventas en terminal POS, controla alertas de stock mínimo y administra permisos de personal respaldados en Firebase.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2.5 shrink-0">
                  <button
                    onClick={openNewProductModal}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition"
                  >
                    <PackagePlus className="w-4 h-4" />
                    <span>Agregar Producto</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('pos')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-semibold transition"
                  >
                    <ShoppingCart className="w-4 h-4 text-emerald-400" />
                    <span>Nueva Venta POS</span>
                  </button>
                </div>
              </div>

              {/* 4 KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/90 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Valor Total del Inventario</span>
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                      <DollarSign className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {formatMoney(kpis.totalInventoryValue)}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
                    <span>Costo base: {formatMoney(kpis.totalInventoryCost)}</span>
                    <span className="text-emerald-400 flex items-center gap-0.5 font-medium">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      Activo
                    </span>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/90 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Ingresos por Ventas (POS)</span>
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {formatMoney(kpis.totalRevenue)}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
                    <span>Utilidad neta: {formatMoney(kpis.totalProfit)}</span>
                    <span className="text-emerald-400 font-medium">{kpis.salesCount} tickets</span>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/90 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Existencias Totales</span>
                    <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
                      <Package className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {kpis.totalUnits} <span className="text-sm font-normal text-slate-400">unidades</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
                    <span>{products.length} SKUs registrados</span>
                    <span className="text-sky-400 font-medium">{categories.length - 1} categorías</span>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/90 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Alertas de Reabastecimiento</span>
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {kpis.lowStockCount + kpis.outOfStockCount}{' '}
                    <span className="text-sm font-normal text-slate-400">alertas</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
                    <span className="text-amber-400">{kpis.lowStockCount} stock bajo</span>
                    <span className="text-rose-400 font-medium">{kpis.outOfStockCount} agotados</span>
                  </div>
                </div>
              </div>

              {/* Critical Stock Alerts & Recent Sales Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Low Stock Alerts Panel */}
                <div className="lg:col-span-1 rounded-2xl bg-slate-900/90 border border-slate-800/90 flex flex-col justify-between">
                  <div>
                    <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <h3 className="font-bold text-sm text-white">Alertas de Stock Crítico</h3>
                      </div>
                      <button
                        onClick={() => {
                          setInvStockFilter('low');
                          setActiveTab('inventory');
                        }}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                      >
                        Ver todo
                      </button>
                    </div>

                    <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                      {[...kpis.outOfStockItems, ...kpis.lowStockItems].length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-xs">
                          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                          Todos los productos cuentan con niveles óptimos de stock.
                        </div>
                      ) : (
                        [...kpis.outOfStockItems, ...kpis.lowStockItems].slice(0, 6).map((item) => {
                          const isOut = Number(item.stock) <= 0;
                          return (
                            <div
                              key={item.id}
                              className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-10 h-10 rounded-lg object-cover bg-slate-800 shrink-0"
                                  onError={(e) => {
                                    e.target.src = 'https://placehold.co/100x100/1e293b/cbd5e1?text=SKU';
                                  }}
                                />
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-white truncate">{item.name}</p>
                                  <p className="text-[11px] text-slate-400">
                                    SKU: {item.sku} • Mín: {item.minStock}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                    isOut
                                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  }`}
                                >
                                  {isOut ? 'Agotado' : `${item.stock} uds`}
                                </span>
                                <button
                                  onClick={() => handleQuickStockAdjust(item, 5)}
                                  className="px-2 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-semibold transition"
                                  title="Reabastecer +5 unidades rápidamente"
                                >
                                  +5
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 rounded-b-2xl">
                    <button
                      onClick={() => setActiveTab('inventory')}
                      className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
                    >
                      Gestionar Almacén Completo
                    </button>
                  </div>
                </div>

                {/* Recent POS Transactions Table */}
                <div className="lg:col-span-2 rounded-2xl bg-slate-900/90 border border-slate-800/90 flex flex-col justify-between">
                  <div>
                    <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-sm text-white">Últimas Transacciones (Terminal POS)</h3>
                        <p className="text-xs text-slate-400">Ventas sincronizadas en tiempo real con Firestore</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('reports')}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                      >
                        <span>Historial completo</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase text-slate-400 bg-slate-950/40">
                            <th className="py-3 px-4">Comprobante</th>
                            <th className="py-3 px-4">Cliente / Cajero</th>
                            <th className="py-3 px-4">Artículos</th>
                            <th className="py-3 px-4">Método</th>
                            <th className="py-3 px-4 text-right">Total</th>
                            <th className="py-3 px-4 text-center">Ticket</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-xs">
                          {sales.slice(0, 6).map((sale) => (
                            <tr key={sale.id} className="hover:bg-slate-800/40 transition">
                              <td className="py-3 px-4 font-mono font-semibold text-indigo-300">
                                {sale.receiptNumber}
                              </td>
                              <td className="py-3 px-4">
                                <p className="font-medium text-white">{sale.customerName}</p>
                                <p className="text-[11px] text-slate-400">Por: {sale.cashier}</p>
                              </td>
                              <td className="py-3 px-4 text-slate-300">
                                {(sale.items || []).reduce((a, b) => a + b.qty, 0)} uds
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-200 border border-slate-700">
                                  {sale.paymentMethod}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-emerald-400">
                                {formatMoney(sale.total)}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  onClick={() => setReceiptModalSale(sale)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition"
                                  title="Ver Ticket de Venta"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 rounded-b-2xl flex items-center justify-between text-xs text-slate-400">
                    <span>Mostrando las últimas {Math.min(6, sales.length)} ventas registradas</span>
                    <span className="text-emerald-400 font-semibold">
                      Total Acumulado: {formatMoney(kpis.totalRevenue)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==========================================
              MODULE 2: TERMINAL DE VENTAS (POS)
          ========================================== */}
          {activeTab === 'pos' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 7 Cols: Product Catalog & Barcode Scanner */}
              <div className="lg:col-span-7 xl:col-span-8 space-y-4">
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Barcode className="w-5 h-5 text-indigo-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={posSearch}
                        onChange={(e) => setPosSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && posFilteredProducts.length === 1) {
                            addToCart(posFilteredProducts[0]);
                            setPosSearch('');
                          }
                        }}
                        placeholder="Escanear código de barras, buscar por SKU o nombre (Enter para añadir)..."
                        className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Category Pills */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setPosCategory(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition ${
                          posCategory === cat
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {posFilteredProducts.map((product) => {
                    const stock = Number(product.stock) || 0;
                    const isOut = stock <= 0;
                    const inCartItem = cart.find((c) => c.id === product.id);
                    return (
                      <div
                        key={product.id}
                        onClick={() => addToCart(product)}
                        className={`group rounded-2xl bg-slate-900/90 border transition-all overflow-hidden flex flex-col justify-between cursor-pointer ${
                          isOut
                            ? 'border-slate-800/60 opacity-60'
                            : inCartItem
                            ? 'border-indigo-500 ring-1 ring-indigo-500/50'
                            : 'border-slate-800/90 hover:border-indigo-500/60 hover:shadow-xl'
                        }`}
                      >
                        <div>
                          <div className="relative h-36 bg-slate-950 overflow-hidden">
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                              onError={(e) => {
                                e.target.src = 'https://placehold.co/400x300/1e293b/cbd5e1?text=Producto';
                              }}
                            />
                            <div className="absolute top-2.5 left-2.5">
                              <span className="px-2 py-0.5 rounded-md bg-slate-950/85 backdrop-blur-sm text-[10px] font-mono text-slate-300 border border-slate-700">
                                {product.sku}
                              </span>
                            </div>
                            <div className="absolute top-2.5 right-2.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                  isOut
                                    ? 'bg-rose-600 text-white'
                                    : stock <= product.minStock
                                    ? 'bg-amber-500 text-slate-950'
                                    : 'bg-emerald-500/90 text-slate-950'
                                }`}
                              >
                                {isOut ? 'Agotado' : `${stock} disp.`}
                              </span>
                            </div>
                            {inCartItem && (
                              <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold shadow-lg">
                                En carrito: {inCartItem.qty}
                              </div>
                            )}
                          </div>

                          <div className="p-4">
                            <p className="text-[11px] text-indigo-400 font-medium">{product.category}</p>
                            <h4 className="font-bold text-sm text-white line-clamp-1 mt-0.5">
                              {product.name}
                            </h4>
                          </div>
                        </div>

                        <div className="px-4 pb-4 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                          <span className="text-lg font-extrabold text-white">
                            {formatMoney(product.salePrice)}
                          </span>
                          <span className="p-2 rounded-xl bg-indigo-600/20 group-hover:bg-indigo-600 text-indigo-300 group-hover:text-white transition">
                            <Plus className="w-4 h-4" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right 5 Cols: Active POS Ticket & Payment Box */}
              <div className="lg:col-span-5 xl:col-span-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col sticky top-24">
                <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white">Ticket de Venta Actual</h3>
                      <p className="text-[11px] text-slate-400">Terminal POS Sincronizada</p>
                    </div>
                  </div>
                  {cart.length > 0 && (
                    <button
                      onClick={() => setCart([])}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Vaciar</span>
                    </button>
                  )}
                </div>

                {/* Customer Input */}
                <div className="px-5 py-3 bg-slate-950/50 border-b border-slate-800">
                  <label className="text-[11px] text-slate-400 block mb-1">Cliente / Razón Social</label>
                  <input
                    type="text"
                    value={posCustomer}
                    onChange={(e) => setPosCustomer(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                    placeholder="Nombre del cliente o NIF..."
                  />
                </div>

                {/* Cart Items List */}
                <div className="p-4 space-y-2.5 max-h-80 overflow-y-auto divide-y divide-slate-800/50">
                  {cart.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <ShoppingCart className="w-10 h-10 text-slate-700 mx-auto" />
                      <p className="text-sm font-medium text-slate-400">El carrito está vacío</p>
                      <p className="text-xs text-slate-500">
                        Haz clic en cualquier producto o escanea su código de barras para comenzar.
                      </p>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div key={item.id} className="pt-2.5 first:pt-0 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white truncate">{item.name}</p>
                          <p className="text-[11px] text-slate-400">
                            {formatMoney(item.price)} c/u • <span className="font-mono">{item.sku}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateCartQty(item.id, item.qty - 1)}
                            className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
                          >
                            -
                          </button>
                          <span className="w-7 text-center text-xs font-bold text-white">{item.qty}</span>
                          <button
                            onClick={() => updateCartQty(item.id, item.qty + 1)}
                            className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
                          >
                            +
                          </button>
                        </div>
                        <div className="text-right w-20">
                          <p className="text-xs font-bold text-emerald-400">
                            {formatMoney(item.price * item.qty)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Payment Method & Totals Breakdown */}
                <div className="p-5 border-t border-slate-800 bg-slate-950/60 space-y-4 rounded-b-2xl">
                  {/* Payment Method Selector */}
                  <div>
                    <label className="text-[11px] font-semibold uppercase text-slate-400 block mb-2">
                      Método de Pago
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'Tarjeta', icon: CreditCard },
                        { id: 'Efectivo', icon: Banknote },
                        { id: 'Transferencia', icon: Smartphone }
                      ].map((pm) => {
                        const Icon = pm.icon;
                        return (
                          <button
                            key={pm.id}
                            type="button"
                            onClick={() => setPosPaymentMethod(pm.id)}
                            className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-semibold transition ${
                              posPaymentMethod === pm.id
                                ? 'bg-indigo-600/20 border-indigo-500 text-white'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{pm.id}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Discount & Cash Received */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Descuento (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={posDiscountPct}
                        onChange={(e) => setPosDiscountPct(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                      />
                    </div>
                    {posPaymentMethod === 'Efectivo' && (
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Efectivo Recibido</label>
                        <input
                          type="number"
                          placeholder={cartTotals.total.toFixed(2)}
                          value={posCashReceived}
                          onChange={(e) => setPosCashReceived(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* Breakdown */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Base Imponible:</span>
                      <span>{formatMoney(cartTotals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>IVA ({settings.taxRate}% incluido):</span>
                      <span>{formatMoney(cartTotals.tax)}</span>
                    </div>
                    {cartTotals.discountAmount > 0 && (
                      <div className="flex justify-between text-amber-400">
                        <span>Descuento aplicado:</span>
                        <span>-{formatMoney(cartTotals.discountAmount)}</span>
                      </div>
                    )}
                    {posPaymentMethod === 'Efectivo' && Number(posCashReceived) > cartTotals.total && (
                      <div className="flex justify-between text-indigo-300 font-semibold">
                        <span>Cambio a devolver:</span>
                        <span>{formatMoney(Number(posCashReceived) - cartTotals.total)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-extrabold text-white pt-2 border-t border-slate-800">
                      <span>TOTAL A COBRAR:</span>
                      <span className="text-emerald-400">{formatMoney(cartTotals.total)}</span>
                    </div>
                  </div>

                  <button
                    disabled={cart.length === 0 || isProcessingSale}
                    onClick={handleCheckoutSale}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>
                      {isProcessingSale
                        ? 'Sincronizando Venta...'
                        : `Cobrar ${formatMoney(cartTotals.total)} y Emitir Ticket`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==========================================
              MODULE 3: INVENTARIO Y STOCK
          ========================================== */}
          {activeTab === 'inventory' && (
            <div className="space-y-5">
              {/* Filter & Action Bar */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row gap-3 flex-1">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={invSearch}
                      onChange={(e) => setInvSearch(e.target.value)}
                      placeholder="Buscar por nombre, código SKU o código de barras EAN..."
                      className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <select
                    value={invCategory}
                    onChange={(e) => setInvCategory(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        Categoría: {c}
                      </option>
                    ))}
                  </select>

                  <select
                    value={invStockFilter}
                    onChange={(e) => setInvStockFilter(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
                  >
                    <option value="all">Todos los estados de stock</option>
                    <option value="ok">Stock Óptimo</option>
                    <option value="low">Stock Bajo (Alerta)</option>
                    <option value="out">Agotados (Sin Stock)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={exportInventoryCSV}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exportar CSV</span>
                  </button>
                  <button
                    onClick={openNewProductModal}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nuevo Producto</span>
                  </button>
                </div>
              </div>

              {/* Inventory Table */}
              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase text-slate-400 bg-slate-950/60">
                        <th className="py-3.5 px-4">Producto / Ubicación</th>
                        <th className="py-3.5 px-4">SKU / Código</th>
                        <th className="py-3.5 px-4">Categoría</th>
                        <th className="py-3.5 px-4 text-right">Costo</th>
                        <th className="py-3.5 px-4 text-right">Precio Venta</th>
                        <th className="py-3.5 px-4 text-center">Existencias</th>
                        <th className="py-3.5 px-4 text-center">Ajuste Rápido</th>
                        <th className="py-3.5 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs">
                      {filteredProducts.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-500">
                            No se encontraron productos que coincidan con los filtros seleccionados.
                          </td>
                        </tr>
                      ) : (
                        filteredProducts.map((product) => {
                          const stock = Number(product.stock) || 0;
                          const minStock = Number(product.minStock || settings.lowStockDefault);
                          const isOut = stock <= 0;
                          const isLow = stock > 0 && stock <= minStock;
                          const marginPct =
                            product.salePrice > 0
                              ? (((product.salePrice - product.costPrice) / product.salePrice) * 100).toFixed(0)
                              : 0;

                          return (
                            <tr key={product.id} className="hover:bg-slate-800/35 transition">
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    className="w-11 h-11 rounded-xl object-cover bg-slate-800 border border-slate-700 shrink-0"
                                    onError={(e) => {
                                      e.target.src = 'https://placehold.co/100x100/1e293b/cbd5e1?text=IMG';
                                    }}
                                  />
                                  <div>
                                    <p className="font-bold text-white text-xs">{product.name}</p>
                                    <p className="text-[11px] text-slate-400">
                                      {product.supplier} • {product.location}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="font-mono font-semibold text-indigo-300 block">
                                  {product.sku}
                                </span>
                                <span className="font-mono text-[11px] text-slate-500">
                                  {product.barcode}
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 text-[11px] font-medium">
                                  {product.category}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right text-slate-300">
                                {formatMoney(product.costPrice)}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <span className="font-bold text-white block">
                                  {formatMoney(product.salePrice)}
                                </span>
                                <span className="text-[10px] text-emerald-400">Margen {marginPct}%</span>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                                    isOut
                                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                      : isLow
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isOut ? 'bg-rose-400' : isLow ? 'bg-amber-400' : 'bg-emerald-400'
                                    }`}
                                  />
                                  {stock} {product.unit || 'uds'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <div className="inline-flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                                  <button
                                    onClick={() => handleQuickStockAdjust(product, -1)}
                                    className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold"
                                    title="Restar 1 unidad"
                                  >
                                    -1
                                  </button>
                                  <button
                                    onClick={() => handleQuickStockAdjust(product, 1)}
                                    className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white font-bold"
                                    title="Sumar 1 unidad"
                                  >
                                    +1
                                  </button>
                                  <button
                                    onClick={() => handleQuickStockAdjust(product, 10)}
                                    className="px-1.5 h-6 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-[11px] font-bold"
                                    title="Sumar 10 unidades"
                                  >
                                    +10
                                  </button>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    onClick={() => openEditProductModal(product)}
                                    className="p-2 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition"
                                    title="Editar producto"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProduct(product)}
                                    className="p-2 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition"
                                    title="Eliminar producto"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==========================================
              MODULE 4: PERSONAL Y USUARIOS
          ========================================== */}
          {activeTab === 'staff' && (
            <div className="space-y-6">
              {/* Header Bar */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row gap-3 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                      placeholder="Buscar personal por nombre o correo..."
                      className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <select
                    value={staffRoleFilter}
                    onChange={(e) => setStaffRoleFilter(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
                  >
                    <option value="Todos">Todos los Roles</option>
                    <option value="Administrador">Administrador</option>
                    <option value="Gerente">Gerente</option>
                    <option value="Cajero">Cajero</option>
                    <option value="Almacenista">Almacenista</option>
                  </select>
                </div>

                <button
                  onClick={openNewStaffModal}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Nuevo Usuario / Personal</span>
                </button>
              </div>

              {/* Staff Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {filteredStaff.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-2xl bg-slate-900/90 border border-slate-800/90 p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 transition"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={member.avatar}
                            alt={member.name}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-700 bg-slate-800"
                            onError={(e) => {
                              e.target.src = 'https://placehold.co/100x100/312e81/e0e7ff?text=USR';
                            }}
                          />
                          <div>
                            <h4 className="font-bold text-sm text-white">{member.name}</h4>
                            <p className="text-xs text-indigo-400 font-medium">{member.role}</p>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            member.status === 'Activo'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {member.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-800/80">
                        <p className="truncate">📧 {member.email}</p>
                        <p>📞 {member.phone}</p>
                        <p>🏢 {member.branch}</p>
                        <p>🕒 Turno: {member.shift}</p>
                      </div>

                      <div className="pt-2">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">
                          Permisos de Acceso
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {(member.permissions || []).map((perm) => (
                            <span
                              key={perm}
                              className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[10px] text-slate-300 uppercase"
                            >
                              {perm}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">{member.lastAccess}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEditStaffModal(member)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition"
                          title="Editar permisos y perfil"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteStaff(member)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition"
                          title="Dar de baja"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==========================================
              MODULE 5: REPORTES Y ANALÍTICAS
          ========================================== */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              {/* Category Distribution & Financial Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Valuation by Category */}
                <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-white">Valorización de Inventario por Categoría</h3>
                      <p className="text-xs text-slate-400">Distribución de capital en stock a precio de venta</p>
                    </div>
                    <BarChart3 className="w-5 h-5 text-indigo-400" />
                  </div>

                  <div className="space-y-3 pt-2">
                    {categories
                      .filter((c) => c !== 'Todas')
                      .map((cat) => {
                        const catProducts = products.filter((p) => p.category === cat);
                        const catValue = catProducts.reduce(
                          (acc, p) => acc + (Number(p.salePrice) || 0) * (Number(p.stock) || 0),
                          0
                        );
                        const pct =
                          kpis.totalInventoryValue > 0
                            ? Math.round((catValue / kpis.totalInventoryValue) * 100)
                            : 0;
                        return (
                          <div key={cat} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium text-slate-200">
                                {cat} ({catProducts.length} SKUs)
                              </span>
                              <span className="font-bold text-white">
                                {formatMoney(catValue)} ({pct}%)
                              </span>
                            </div>
                            <div className="w-full h-2.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                              <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                                style={{ width: `${Math.max(4, pct)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Payment Methods Breakdown */}
                <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-white">Rendimiento Financiero por Método de Pago</h3>
                      <p className="text-xs text-slate-400">Auditoría de caja y margen bruto acumulado</p>
                    </div>
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    {['Tarjeta', 'Efectivo', 'Transferencia'].map((method) => {
                      const methodSales = sales.filter((s) => s.paymentMethod === method);
                      const sum = methodSales.reduce((a, b) => a + (Number(b.total) || 0), 0);
                      return (
                        <div
                          key={method}
                          className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1"
                        >
                          <span className="text-xs text-slate-400">{method}</span>
                          <p className="text-lg font-bold text-white">{formatMoney(sum)}</p>
                          <p className="text-[11px] text-emerald-400">{methodSales.length} operaciones</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-indigo-200 font-semibold">Ganancia Neta Estimada (Ventas - Costo)</p>
                      <p className="text-[11px] text-slate-400">Calculada automáticamente sobre cada producto vendido</p>
                    </div>
                    <span className="text-xl font-extrabold text-emerald-400">
                      {formatMoney(kpis.totalProfit)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Full Sales Ledger */}
              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden">
                <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-white">Libro Mayor de Ventas e Historial de Tickets</h3>
                    <p className="text-xs text-slate-400">Haz clic en cualquier venta para reimprimir el comprobante</p>
                  </div>
                  <button
                    onClick={exportInventoryCSV}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar CSV</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase text-slate-400 bg-slate-950/60">
                        <th className="py-3 px-4">Factura / Ticket</th>
                        <th className="py-3 px-4">Fecha / Hora</th>
                        <th className="py-3 px-4">Cliente</th>
                        <th className="py-3 px-4">Operador</th>
                        <th className="py-3 px-4">Pago</th>
                        <th className="py-3 px-4 text-right">Impuestos</th>
                        <th className="py-3 px-4 text-right">Utilidad</th>
                        <th className="py-3 px-4 text-right">Total</th>
                        <th className="py-3 px-4 text-center">Recibo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs">
                      {sales.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-mono font-bold text-indigo-300">{s.receiptNumber}</td>
                          <td className="py-3 px-4 text-slate-400">
                            {new Date(s.createdAt).toLocaleString('es-ES')}
                          </td>
                          <td className="py-3 px-4 text-white font-medium">{s.customerName}</td>
                          <td className="py-3 px-4 text-slate-300">{s.cashier}</td>
                          <td className="py-3 px-4">{s.paymentMethod}</td>
                          <td className="py-3 px-4 text-right text-slate-400">{formatMoney(s.tax)}</td>
                          <td className="py-3 px-4 text-right text-indigo-300 font-semibold">
                            +{formatMoney(s.profit)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-400">
                            {formatMoney(s.total)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => setReceiptModalSale(s)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==========================================
              MODULE 6: CONFIGURACIÓN DEL INVENTARIO Y FIREBASE
          ========================================== */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Store & Inventory Parameters Form */}
              <form
                onSubmit={handleSaveSettings}
                className="lg:col-span-7 rounded-2xl bg-slate-900/90 border border-slate-800 p-6 space-y-5"
              >
                <div className="border-b border-slate-800 pb-4">
                  <h3 className="font-bold text-base text-white">Parámetros Comerciales y de Inventario</h3>
                  <p className="text-xs text-slate-400">
                    Estos ajustes se guardan en Firestore y se aplican a todos los terminales POS conectados.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Nombre Comercial de la Tienda</label>
                    <input
                      type="text"
                      value={settings.storeName}
                      onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Razón Social / Empresa</label>
                    <input
                      type="text"
                      value={settings.legalName}
                      onChange={(e) => setSettings({ ...settings, legalName: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">NIF / CIF / Identificación Fiscal</label>
                    <input
                      type="text"
                      value={settings.taxId}
                      onChange={(e) => setSettings({ ...settings, taxId: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Teléfono de Atención</label>
                    <input
                      type="text"
                      value={settings.phone}
                      onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Símbolo de Moneda</label>
                    <input
                      type="text"
                      value={settings.currencySymbol}
                      onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Impuesto IVA (%)</label>
                    <input
                      type="number"
                      value={settings.taxRate}
                      onChange={(e) => setSettings({ ...settings, taxRate: Number(e.target.value) })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-slate-400 block mb-1">Dirección Física del Establecimiento</label>
                    <input
                      type="text"
                      value={settings.address}
                      onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-slate-400 block mb-1">Mensaje al Pie del Ticket POS</label>
                    <input
                      type="text"
                      value={settings.receiptFooter}
                      onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <span className="text-xs font-semibold text-white block">
                        Descuento Automático de Stock en POS
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Resta automáticamente las unidades en Firestore al completar una venta
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoDeductStock}
                      onChange={(e) => setSettings({ ...settings, autoDeductStock: e.target.checked })}
                      className="w-4 h-4 accent-indigo-600 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <span className="text-xs font-semibold text-white block">
                        Permitir Ventas con Stock en Cero (Stock Negativo)
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Habilita vender productos aunque figuren agotados en el sistema
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.allowNegativeStock}
                      onChange={(e) => setSettings({ ...settings, allowNegativeStock: e.target.checked })}
                      className="w-4 h-4 accent-indigo-600 rounded"
                    />
                  </label>
                </div>

                <div className="pt-3 flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition"
                  >
                    Guardar Configuración en Firebase
                  </button>
                </div>
              </form>

              {/* Firebase Infrastructure Status & Hosting/Storage Panel */}
              <div className="lg:col-span-5 space-y-5">
                <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Cloud className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white">Estado de Servicios Firebase</h3>
                      <p className="text-xs text-slate-400">Auth, Firestore Database, Storage & Hosting</p>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-300 font-medium">Firebase Authentication</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold">
                        Conectado ({user ? 'Sesión Activa' : 'Cargando'})
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-300 font-medium">Cloud Firestore (Real-time)</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold">
                        {products.length} Prod • {sales.length} Ventas
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-300 font-medium">Storage / Compresión Multimedia</span>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-semibold">
                        Motor HTML5 Canvas Activo
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <p className="text-[11px] text-slate-400 mb-1">ID Completo de Usuario Autenticado:</p>
                      <p className="font-mono text-[11px] text-indigo-300 break-all select-all">
                        {user?.uid || 'Sin sesión'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <button
                      type="button"
                      onClick={() => seedDatabaseIfNeeded(true)}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 transition"
                    >
                      <RefreshCw className="w-4 h-4 text-indigo-400" />
                      <span>Restaurar / Recargar Datos de Demostración</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ==========================================
          MODAL 1: NUEVO / EDITAR PRODUCTO (CON SUBIDA DE IMAGEN)
      ========================================== */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl my-8">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Package className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base text-white">
                  {editingProduct ? 'Editar Producto del Inventario' : 'Registrar Nuevo Producto'}
                </h3>
              </div>
              <button
                onClick={() => setProductModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              {/* Image Preview & Storage Upload */}
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
                <img
                  src={productForm.imageUrl || 'https://placehold.co/200x200/1e293b/cbd5e1?text=Producto'}
                  alt="Vista previa"
                  className="w-20 h-20 rounded-xl object-cover bg-slate-800 border border-slate-700 shrink-0"
                  onError={(e) => {
                    e.target.src = 'https://placehold.co/200x200/1e293b/cbd5e1?text=Sin+Imagen';
                  }}
                />
                <div className="flex-1 space-y-2 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingImage ? 'Comprimiendo...' : 'Subir Foto desde Dispositivo'}</span>
                    </button>
                    <span className="text-[11px] text-slate-500">
                      Se optimiza y almacena en la nube automáticamente
                    </span>
                  </div>
                  <input
                    type="text"
                    value={productForm.imageUrl}
                    onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                    placeholder="O pega la URL de una imagen..."
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs text-slate-400 block mb-1">Nombre Comercial del Producto *</label>
                  <input
                    type="text"
                    required
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    placeholder="Ej. Monitor Gamer 27 Pulgadas 144Hz"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Código SKU *</label>
                  <input
                    type="text"
                    required
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    placeholder="TEC-001"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Código de Barras (EAN / UPC)</label>
                  <input
                    type="text"
                    value={productForm.barcode}
                    onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                    placeholder="7501031311309"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Categoría</label>
                  <select
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  >
                    {categories
                      .filter((c) => c !== 'Todas')
                      .map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    <option value="General">General</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Proveedor</label>
                  <input
                    type="text"
                    value={productForm.supplier}
                    onChange={(e) => setProductForm({ ...productForm, supplier: e.target.value })}
                    placeholder="Nombre del distribuidor"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Costo de Adquisición ({settings.currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={productForm.costPrice}
                    onChange={(e) => setProductForm({ ...productForm, costPrice: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Precio de Venta al Público ({settings.currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={productForm.salePrice}
                    onChange={(e) => setProductForm({ ...productForm, salePrice: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Stock Actual en Almacén *</label>
                  <input
                    type="number"
                    required
                    value={productForm.stock}
                    onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Alerta de Stock Mínimo</label>
                  <input
                    type="number"
                    value={productForm.minStock}
                    onChange={(e) => setProductForm({ ...productForm, minStock: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs text-slate-400 block mb-1">Ubicación Física en Almacén</label>
                  <input
                    type="text"
                    value={productForm.location}
                    onChange={(e) => setProductForm({ ...productForm, location: e.target.value })}
                    placeholder="Ej. Pasillo A - Estante 3"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/25"
                >
                  {editingProduct ? 'Guardar Cambios' : 'Registrar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 2: NUEVO / EDITAR PERSONAL Y USUARIOS
      ========================================== */}
      {staffModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base text-white">
                  {editingStaff ? 'Editar Usuario del Sistema' : 'Alta de Nuevo Usuario / Personal'}
                </h3>
              </div>
              <button
                onClick={() => setStaffModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs text-slate-400 block mb-1">Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    value={staffForm.name}
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                    placeholder="Ej. Ana Belén Martínez"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Correo Electrónico *</label>
                  <input
                    type="email"
                    required
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    placeholder="usuario@stitchretail.com"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Rol en el Sistema</label>
                  <select
                    value={staffForm.role}
                    onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  >
                    <option value="Administrador">Administrador</option>
                    <option value="Gerente">Gerente</option>
                    <option value="Cajero">Cajero</option>
                    <option value="Almacenista">Almacenista</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Estado</label>
                  <select
                    value={staffForm.status}
                    onChange={(e) => setStaffForm({ ...staffForm, status: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  >
                    <option value="Activo">Activo</option>
                    <option value="Vacaciones">Vacaciones</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs text-slate-400 block mb-1">Sucursal Asignada</label>
                  <input
                    type="text"
                    value={staffForm.branch}
                    onChange={(e) => setStaffForm({ ...staffForm, branch: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
              </div>

              {/* Permissions Checkboxes */}
              <div className="pt-2">
                <label className="text-xs text-slate-400 block mb-2">Módulos Autorizados</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'pos', label: 'Terminal POS' },
                    { id: 'inventory', label: 'Inventario' },
                    { id: 'staff', label: 'Personal' },
                    { id: 'reports', label: 'Reportes' },
                    { id: 'settings', label: 'Configuración' }
                  ].map((perm) => {
                    const checked = staffForm.permissions.includes(perm.id);
                    return (
                      <button
                        key={perm.id}
                        type="button"
                        onClick={() => toggleStaffPermission(perm.id)}
                        className={`px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-2 transition ${
                          checked
                            ? 'bg-indigo-600/20 border-indigo-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        <Check className={`w-3.5 h-3.5 ${checked ? 'text-indigo-400' : 'opacity-0'}`} />
                        <span>{perm.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setStaffModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white"
                >
                  Guardar Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 3: COMPROBANTE / TICKET DE VENTA POS
      ========================================== */}
      {receiptModalSale && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl">
            <div className="p-6 space-y-4 font-mono text-xs">
              <div className="text-center border-b border-dashed border-slate-300 pb-4 space-y-1">
                <h3 className="font-bold text-base uppercase">{settings.storeName}</h3>
                <p className="text-[11px] text-slate-600">{settings.legalName}</p>
                <p className="text-[11px] text-slate-600">NIF: {settings.taxId}</p>
                <p className="text-[11px] text-slate-600">{settings.address}</p>
              </div>

              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3">
                <div className="flex justify-between">
                  <span>TICKET:</span>
                  <span className="font-bold">{receiptModalSale.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>FECHA:</span>
                  <span>{new Date(receiptModalSale.createdAt).toLocaleString('es-ES')}</span>
                </div>
                <div className="flex justify-between">
                  <span>CLIENTE:</span>
                  <span>{receiptModalSale.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span>CAJERO:</span>
                  <span>{receiptModalSale.cashier}</span>
                </div>
                <div className="flex justify-between">
                  <span>PAGO:</span>
                  <span>{receiptModalSale.paymentMethod}</span>
                </div>
              </div>

              <div className="space-y-2 border-b border-dashed border-slate-300 pb-3">
                {(receiptModalSale.items || []).map((item, idx) => (
                  <div key={idx} className="flex justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-bold">{item.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {item.qty} x {formatMoney(item.price)}
                      </p>
                    </div>
                    <span className="font-bold">{formatMoney(item.qty * item.price)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>SUBTOTAL:</span>
                  <span>{formatMoney(receiptModalSale.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>IVA ({settings.taxRate}%):</span>
                  <span>{formatMoney(receiptModalSale.tax)}</span>
                </div>
                {receiptModalSale.discount > 0 && (
                  <div className="flex justify-between">
                    <span>DESCUENTO:</span>
                    <span>-{formatMoney(receiptModalSale.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold pt-2 border-t border-slate-300">
                  <span>TOTAL:</span>
                  <span>{formatMoney(receiptModalSale.total)}</span>
                </div>
              </div>

              <div className="text-center pt-3 border-t border-dashed border-slate-300 text-[10px] text-slate-500">
                <p>{settings.receiptFooter}</p>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-100 flex items-center justify-between gap-3">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir</span>
              </button>
              <button
                onClick={() => setReceiptModalSale(null)}
                className="flex-1 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 4: CONFIRMACIÓN PERSONALIZADA
      ========================================== */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-base text-white">{confirmDialog.title}</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white"
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}