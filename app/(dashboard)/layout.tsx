"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
// ទាញយក supabase ពីឯកសារ lib ដែលបានកែថ្មី ដើម្បីធានាថាវាប្រើប្រាស់ Cookies
import { supabase } from "@/lib/supabase"; 
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  ReceiptText, 
  LineChart,
  Wrench,
  Boxes,
  User,
  Settings,
  LogOut,
  Loader2
} from "lucide-react";

// Main Overview Navigation
const mainMenuItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/sales', label: 'Sales', icon: ShoppingCart },
  { href: '/repairs', label: 'Repair', icon: Wrench },
  { href: '/customers', label: 'Customers', icon: User },
  { href: '/purchases', label: 'Purchases', icon: Package },
  { href: '/expenses', label: 'Expenses', icon: ReceiptText },
  { href: '/reports', label: 'Reports', icon: LineChart },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
];

// System Navigation
const systemMenuItems = [
  { href: '/settings', label: 'Settings', icon: Settings }
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // ---------------- State សម្រាប់បង្ហាញ Logo និងឈ្មោះហាង ----------------
  const [appConfig, setAppConfig] = useState({
    name: 'iCase Service',
    logo: '/icase.jpg'
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        // ប្រើប្រាស់ getUser() ដើម្បីទាញយកទិន្នន័យជាក់លាក់ពី Server
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (user?.email) {
          setUserEmail(user.email);
        } else {
          setUserEmail('មិនមានគណនី');
        }
      } catch (e) {
        console.error("Error fetching user:", e);
        setUserEmail('កំហុស (Error)');
      }
    };
    fetchUser();
  }, []);

  // ---------------- ទាញយក និងស្តាប់ការផ្លាស់ប្តូរ Logo/ឈ្មោះហាង ----------------
  useEffect(() => {
    const loadStoreConfig = async () => {
      try {
        // ទាញយកទិន្នន័យពី table settings នៅក្នុង Supabase
        const { data, error } = await supabase
          .from('settings')
          .select('shop_name, logo')
          .limit(1)
          .single();

        if (error) {
          console.error("Error fetching store config:", error);
          return;
        }

        if (data) {
          setAppConfig({
            name: data.shop_name || 'iCase Service',
            logo: data.logo || '/icase.jpg'
          });
        }
      } catch (err) {
        console.error("Failed to load store settings:", err);
      }
    };

    // ដំណើរការពេលបើក Layout ដំបូង
    loadStoreConfig();

    // ចាំស្តាប់ Event ពេលមានការចុច Save ពីទំព័រ Settings ដើម្បីទាញយកថ្មី
    window.addEventListener('settingsUpdated', loadStoreConfig);
    
    // Cleanup ពេលបិទ Layout
    return () => {
      window.removeEventListener('settingsUpdated', loadStoreConfig);
    };
  }, []);

  // មុខងារសម្រាប់ Logout ពេញលេញ
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut(); // លុប Session ចេញពី Supabase និង Cookies
      window.location.href = '/login'; // បង្ខំឲ្យ Browser ប្តូរទំព័រនិង Refresh ដើម្បីសម្អាត State ចាស់
    } catch (e) {
      console.error("Logout error:", e);
      setIsLoggingOut(false);
    }
  };

  // យកអក្សរ ២ ខ្ទង់ដំបូងនៃ Email ធ្វើជា Profile 
  const initials = userEmail && userEmail !== 'មិនមានគណនី' ? userEmail.substring(0, 2).toUpperCase() : 'AD';

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      
      {/* ---------------- SIDEBAR ---------------- */}
      <aside className="w-[280px] bg-gray-950 border-r border-gray-800 flex flex-col flex-shrink-0 transition-all">
        
        {/* Brand & Logo Section */}
        <div className="h-20 flex items-center gap-3.5 px-6 border-b border-gray-800/60">
          <div className="bg-white p-1 rounded-xl flex items-center justify-center shadow-lg w-10 h-10 shrink-0 overflow-hidden">
            {/* ប្រើ <img> ធម្មតាជំនួស next/image ដើម្បីងាយស្រួលបង្ហាញ Base64 Image ឬ URL ពី Imgbb */}
            <img 
              src={appConfig.logo} 
              alt="Store Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex flex-col">
            <h1 className="text-white font-bold text-base tracking-wide leading-tight truncate max-w-[150px]">
              {appConfig.name}
            </h1>
            <p className="text-[10px] text-emerald-400/80 font-bold tracking-widest uppercase mt-0.5">Management</p>
          </div>
        </div>

        {/* Menu List Section (Navigation) */}
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8 scrollbar-hide">
          
          {/* Overview Group */}
          <div>
            <p className="px-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">Overview</p>
            <nav className="space-y-1">
              {mainMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/');
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                      isActive 
                        ? 'bg-emerald-500/10 text-emerald-400 font-medium' 
                        : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-100'
                    }`}
                  >
                    <Icon size={18} className={isActive ? "text-emerald-400" : "text-gray-500 group-hover:text-gray-300 transition-colors"} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          
          {/* System Group */}
          <div>
            <p className="px-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">System</p>
            <nav className="space-y-1">
              {systemMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/');
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                      isActive 
                        ? 'bg-emerald-500/10 text-emerald-400 font-medium' 
                        : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-100'
                    }`}
                  >
                    <Icon size={18} className={isActive ? "text-emerald-400" : "text-gray-500 group-hover:text-gray-300 transition-colors"} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Profile Section (User Profile & Logout) */}
        <div className="p-4 border-t border-gray-800/60 bg-gray-950/50">
          <div className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-800/60 transition-colors group">
            
            {/* User Info */}
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white w-9 h-9 shrink-0 rounded-full flex items-center justify-center font-bold text-sm shadow-md uppercase">
                {initials}
              </div>
              <div className="text-left overflow-hidden">
                <p className="text-gray-200 text-sm font-semibold leading-tight truncate group-hover:text-white transition-colors" title={userEmail || 'Loading...'}>
                  {userEmail || 'កំពុងផ្ទុក...'}
                </p>
                <p className="text-[11px] text-gray-500 font-medium mt-0.5">Shop Manager</p>
              </div>
            </div>

            {/* Logout Button */}
            <button 
              onClick={handleLogout}
              disabled={isLoggingOut}
              title="ចាកចេញ (Logout)"
              className="shrink-0 p-2 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all disabled:opacity-50"
            >
              {isLoggingOut ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <LogOut size={18} />
              )}
            </button>

          </div>
        </div>
      </aside>
      {/* ---------------- MAIN CONTENT ---------------- */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {children}
      </main>
      
    </div>
  );
}