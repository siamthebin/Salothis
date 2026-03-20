import React, { useState, useEffect } from 'react';
import { ShoppingBag, X, Menu, ArrowRight, Plus, Minus, Trash2, LogIn, LogOut, Shield, UploadCloud, Bookmark } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CartItem, Product, Order } from './types';
import { useAuth } from './contexts/AuthContext';
import { signInWithGoogle, logOut, db } from './firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc } from 'firebase/firestore';

export default function App() {
  const { user, role, loading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [savedForLater, setSavedForLater] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);

  // Admin form state
  const [newProduct, setNewProduct] = useState({ name: '', price: '', category: '', image: '', description: '' });

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach(doc => {
        prods.push({ id: doc.id, ...doc.data() } as Product);
      });
      setProducts(prods);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (role === 'admin' && isAdminView) {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const ords: Order[] = [];
        snapshot.forEach(doc => {
          ords.push({ id: doc.id, ...doc.data() } as Order);
        });
        setOrders(ords);
      });
      return () => unsubscribe();
    }
  }, [role, isAdminView]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const saveForLater = (item: CartItem) => {
    setSavedForLater(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i);
      }
      return [...prev, item];
    });
    setCart(prev => prev.filter(i => i.id !== item.id));
  };

  const moveToCart = (item: CartItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i);
      }
      return [...prev, item];
    });
    setSavedForLater(prev => prev.filter(i => i.id !== item.id));
  };

  const removeSavedForLater = (id: string) => {
    setSavedForLater(prev => prev.filter(i => i.id !== id));
  };

  const cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);

  const handleCheckout = async () => {
    if (!user) {
      alert("Please sign in to checkout.");
      await signInWithGoogle();
      return;
    }
    try {
      await addDoc(collection(db, 'orders'), {
        customerId: user.uid,
        customerEmail: user.email,
        items: cart,
        total: cartTotal,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setCart([]);
      setIsCartOpen(false);
      alert("Order placed successfully!");
    } catch (error) {
      console.error("Error placing order", error);
      alert("Failed to place order.");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setNewProduct(prev => ({ ...prev, image: dataUrl }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || role !== 'admin') return;
    try {
      await addDoc(collection(db, 'products'), {
        name: newProduct.name,
        price: Number(newProduct.price),
        category: newProduct.category,
        image: newProduct.image,
        description: newProduct.description,
        createdAt: serverTimestamp(),
        authorUid: user.uid
      });
      setNewProduct({ name: '', price: '', category: '', image: '', description: '' });
      alert("Product added!");
    } catch (error) {
      console.error("Error adding product", error);
      alert("Failed to add product.");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!user || role !== 'admin') return;
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (error) {
      console.error("Error deleting product", error);
    }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;

  if (isAdminView && role === 'admin') {
    return (
      <div className="min-h-screen bg-black text-white font-sans p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-12">
            <h1 className="font-serif text-4xl">Admin Dashboard</h1>
            <button onClick={() => setIsAdminView(false)} className="text-gray-400 hover:text-white transition-colors">
              Back to Store
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Add Product Form */}
            <div className="bg-black p-8 rounded-2xl border border-white/10">
              <h2 className="text-xl font-medium mb-6">Add New Product</h2>
              <form onSubmit={handleAddProduct} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Name</label>
                  <input required value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white/30" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Price ($)</label>
                    <input required type="number" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white/30" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Category</label>
                    <input required value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white/30" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Product Image</label>
                  <div className="flex items-center gap-4">
                    <label className="flex-1 flex flex-col items-center justify-center h-32 border-2 border-dashed border-white/10 rounded-lg hover:border-white/30 transition-colors cursor-pointer bg-black">
                      {newProduct.image ? (
                        <img src={newProduct.image} alt="Preview" className="h-full object-contain p-2" />
                      ) : (
                        <>
                          <UploadCloud className="w-8 h-8 text-gray-500 mb-2" />
                          <span className="text-sm text-gray-500">Click to upload image</span>
                        </>
                      )}
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <textarea required value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white/30 h-24" />
                </div>
                <button type="submit" className="w-full bg-white text-black py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors">
                  Post Product
                </button>
              </form>
            </div>

            {/* Orders List */}
            <div className="bg-black p-8 rounded-2xl border border-white/10 overflow-hidden flex flex-col h-[600px]">
              <h2 className="text-xl font-medium mb-6">Recent Orders</h2>
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {orders.map(order => (
                  <div key={order.id} className="bg-black p-4 rounded-lg border border-white/10">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-medium text-white">{order.customerEmail}</p>
                        <p className="text-xs text-gray-500">Order ID: {order.id}</p>
                      </div>
                      <span className="px-2 py-1 bg-white/5 text-xs rounded-full text-gray-300 capitalize">{order.status}</span>
                    </div>
                    <div className="text-sm text-gray-400 mb-2">
                      {order.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}
                    </div>
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/10">
                      <span className="text-gray-500 text-sm">Total</span>
                      <span className="font-medium text-white">${order.total}</span>
                    </div>
                  </div>
                ))}
                {orders.length === 0 && <p className="text-gray-500 text-center py-8">No orders yet.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white/10">
      {/* Navbar */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-black/80 backdrop-blur-md border-b border-white/10 py-4' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 -ml-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white" title="Menu">
                <Menu className="w-5 h-5" />
              </button>
              
              <AnimatePresence>
                {isMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 mt-2 w-56 bg-black border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden py-1"
                    >
                      {user ? (
                        <>
                          <div className="px-4 py-3 border-b border-white/10 bg-black/50">
                            <p className="text-sm font-medium text-white truncate">{user.displayName || 'User'}</p>
                            <p className="text-xs text-gray-400 truncate">{user.email}</p>
                          </div>
                          {role === 'admin' && (
                            <button 
                              onClick={() => { setIsAdminView(true); setIsMenuOpen(false); }}
                              className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-3"
                            >
                              <Shield className="w-4 h-4" /> Admin Dashboard
                            </button>
                          )}
                          <button 
                            onClick={() => { logOut(); setIsMenuOpen(false); }}
                            className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 hover:text-red-300 transition-colors flex items-center gap-3"
                          >
                            <LogOut className="w-4 h-4" /> Sign Out
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => { signInWithGoogle(); setIsMenuOpen(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-3"
                        >
                          <LogIn className="w-4 h-4" /> Sign In
                        </button>
                      )}
                      
                      <div className="lg:hidden border-t border-white/10 mt-1 pt-1">
                        <a href="#" className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors">Shop</a>
                        <a href="#" className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors">Collections</a>
                        <a href="#" className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors">About</a>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <div className="hidden lg:flex items-center gap-8 text-sm font-medium text-gray-400">
              <a href="#" className="hover:text-white transition-colors">Shop</a>
              <a href="#" className="hover:text-white transition-colors">Collections</a>
              <a href="#" className="hover:text-white transition-colors">About</a>
            </div>
          </div>
          
          <a href="#" className="font-serif text-2xl tracking-wider font-semibold text-white absolute left-1/2 -translate-x-1/2">
            SALOTHIS
          </a>

          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={() => setIsCartOpen(true)}
              className="p-2 -mr-2 hover:bg-white/5 rounded-full transition-colors relative"
            >
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-white text-black text-[10px] font-bold flex items-center justify-center rounded-full">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden bg-black">
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto mt-20">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="font-serif text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight mb-6"
          >
            Embrace the Void.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10"
          >
            Discover our latest collection of premium dark wear. Tailored for the modern minimalist who finds elegance in the shadows.
          </motion.p>
          <motion.button 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
            className="bg-white text-black px-8 py-4 rounded-full font-medium tracking-wide hover:bg-gray-200 transition-colors inline-flex items-center gap-2"
          >
            Explore Collection <ArrowRight className="w-4 h-4" />
          </motion.button>
        </div>
      </section>

      {/* Products Section */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="font-serif text-3xl md:text-4xl mb-3">New Arrivals</h2>
            <p className="text-gray-400">Curated pieces for your dark wardrobe.</p>
          </div>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            No products available yet. {role === 'admin' && "Go to the Admin Dashboard to add some!"}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
            {products.map((product, index) => (
              <motion.div 
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: Math.min(index * 0.1, 0.5) }}
                className="group cursor-pointer relative"
              >
                {role === 'admin' && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id); }}
                    className="absolute top-4 right-4 z-20 px-3 py-1.5 bg-red-500/90 hover:bg-red-500 text-white text-sm font-medium rounded-full transition-opacity flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" /> Remove Product
                  </button>
                )}
                <div className="relative aspect-[3/4] overflow-hidden bg-black border border-white/10 mb-6 rounded-lg">
                  <img 
                    src={product.image} 
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-90 group-hover:opacity-100"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 transition-opacity duration-300 flex flex-col justify-end p-4 gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                      className="w-full bg-white/10 backdrop-blur-md border border-white/20 text-white py-2.5 rounded-full font-medium transition-all duration-300 hover:bg-white/20"
                    >
                      Add to Cart
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); addToCart(product); setIsCartOpen(true); }}
                      className="w-full bg-white text-black py-2.5 rounded-full font-medium transition-all duration-300 hover:bg-gray-200"
                    >
                      Buy Now
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-lg mb-1">{product.name}</h3>
                    <p className="text-gray-500 text-sm">{product.category}</p>
                  </div>
                  <span className="font-medium">${product.price}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-6 mt-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-2">
            <h3 className="font-serif text-2xl mb-4">SALOTHIS</h3>
            <p className="text-gray-500 max-w-sm">
              Premium dark wear for those who appreciate the subtle elegance of the void.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-4">Shop</h4>
            <ul className="space-y-2 text-gray-500 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">New Arrivals</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Outerwear</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Knitwear</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Accessories</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-4">Support</h4>
            <ul className="space-y-2 text-gray-500 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">FAQ</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Shipping & Returns</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-white/10 text-sm text-gray-600 flex flex-col md:flex-row justify-between items-center">
          <p>&copy; {new Date().getFullYear()} Salothis. All rights reserved.</p>
          <div className="flex gap-4 mt-4 md:mt-0">
            <a href="#" className="hover:text-white transition-colors">Instagram</a>
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
          </div>
        </div>
      </footer>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-black border-l border-white/10 z-50 flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h2 className="font-serif text-xl">Your Cart ({cartCount})</h2>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                    <ShoppingBag className="w-12 h-12 opacity-20" />
                    <p>Your cart is empty.</p>
                    <button 
                      onClick={() => setIsCartOpen(false)}
                      className="text-white border-b border-white pb-1 hover:text-gray-300 hover:border-gray-300 transition-colors mt-4"
                    >
                      Continue Shopping
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {cart.map(item => (
                      <div key={item.id} className="flex gap-4">
                        <div className="w-24 h-32 bg-black border border-white/10 rounded-md overflow-hidden shrink-0">
                          <img 
                            src={item.image} 
                            alt={item.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="flex-1 flex flex-col justify-between py-1">
                          <div>
                            <div className="flex justify-between items-start mb-1">
                              <h3 className="font-medium line-clamp-1">{item.name}</h3>
                              <div className="flex items-center gap-1 -mt-1 -mr-1">
                                <button 
                                  onClick={() => saveForLater(item)}
                                  className="text-gray-500 hover:text-white transition-colors p-1"
                                  title="Save for later"
                                >
                                  <Bookmark className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => updateQuantity(item.id, -item.quantity)}
                                  className="text-gray-500 hover:text-red-400 transition-colors p-1"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <p className="text-gray-500 text-sm">{item.category}</p>
                          </div>
                          
                          <div className="flex items-center justify-between mt-4">
                            <div className="flex items-center border border-white/10 rounded-full bg-black">
                              <button 
                                onClick={() => updateQuantity(item.id, -1)}
                                className="p-2 hover:text-white text-gray-400 transition-colors"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                              <button 
                                onClick={() => updateQuantity(item.id, 1)}
                                className="p-2 hover:text-white text-gray-400 transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <span className="font-medium">${item.price * item.quantity}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {savedForLater.length > 0 && (
                  <div className="mt-10 border-t border-white/10 pt-6">
                    <h3 className="font-serif text-lg mb-4">Saved for later ({savedForLater.length})</h3>
                    <div className="space-y-6">
                      {savedForLater.map(item => (
                        <div key={item.id} className="flex gap-4 opacity-70 hover:opacity-100 transition-opacity">
                          <div className="w-20 h-28 bg-black border border-white/10 rounded-md overflow-hidden shrink-0">
                            <img 
                              src={item.image} 
                              alt={item.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="flex-1 flex flex-col justify-between py-1">
                            <div>
                              <div className="flex justify-between items-start mb-1">
                                <h3 className="font-medium line-clamp-1 text-sm">{item.name}</h3>
                                <button 
                                  onClick={() => removeSavedForLater(item.id)}
                                  className="text-gray-500 hover:text-red-400 transition-colors p-1 -mr-1 -mt-1"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <p className="text-gray-500 text-xs">{item.category}</p>
                            </div>
                            
                            <div className="flex items-center justify-between mt-2">
                              <span className="font-medium text-sm">${item.price}</span>
                              <button 
                                onClick={() => moveToCart(item)}
                                className="text-xs border border-white/20 hover:bg-white/10 px-3 py-1.5 rounded-full transition-colors"
                              >
                                Move to Cart
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-6 border-t border-white/10 bg-black">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-gray-400">Subtotal</span>
                    <span className="font-serif text-2xl">${cartTotal}</span>
                  </div>
                  <button 
                    onClick={handleCheckout}
                    className="w-full bg-white text-black py-4 rounded-full font-medium tracking-wide hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                  >
                    Checkout <ArrowRight className="w-4 h-4" />
                  </button>
                  <p className="text-center text-xs text-gray-600 mt-4">
                    Shipping and taxes calculated at checkout.
                  </p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
