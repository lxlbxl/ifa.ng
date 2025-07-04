import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Search, User } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

interface NavItem {
  label: string;
  path: string;
  hash?: string;
}

const navItems: NavItem[] = [
  { label: "Home", path: "/", hash: "home" },
  { label: "How It Works", path: "/", hash: "how-it-works" },
  { label: "Babalawos", path: "/dashboard", hash: "babalawos" },
  { label: "About", path: "/", hash: "about" }
];

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Handle scroll lock and z-index on mobile overlay
  // Prevent background scroll when menu open
  React.useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    // Cleanup
    return () => { document.body.style.overflow = ""; };
  }, [isMenuOpen]);

  const handleAuthNavigate = (tab: "signin" | "signup") => {
    navigate(`/auth?tab=${tab}`);
    setIsMenuOpen(false);
  };

  const handleNavigation = (item: NavItem) => {
    setIsMenuOpen(false);
    
    if (item.path === "/" && item.hash) {
      // If we're already on the home page, just scroll to the section
      if (window.location.pathname === "/") {
        const element = document.getElementById(item.hash);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      } else {
        // Navigate to home page with hash
        navigate(`/${item.hash ? `#${item.hash}` : ""}`);
      }
    } else {
      // Navigate to other pages
      navigate(item.path);
    }
  };

  return (
    <header className="bg-white/95 backdrop-blur-sm shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">I</span>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              IFA.ng
            </span>
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {navItems.map((item, index) => (
              <button
                key={index}
                onClick={() => handleNavigation(item)}
                className="text-gray-700 hover:text-primary transition-colors focus:outline-none"
              >
                {item.label}
              </button>
            ))}
          </nav>
          
          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-4">
            <Button
              variant="outline"
              className="border-primary text-primary hover:bg-primary hover:text-white transition-all duration-300"
              onClick={() => handleAuthNavigate("signin")}
            >
              <User className="w-4 h-4 mr-2" />
              Login
            </Button>
            <Button
              className="bg-primary text-white hover:bg-primary/90 transition-all duration-300"
              onClick={() => handleAuthNavigate("signup")}
            >
              Sign Up
            </Button>
          </div>
          
          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMenuOpen((v) => !v)}
            aria-label={isMenuOpen ? "Close main menu" : "Open main menu"}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu Backdrop */}
        <div
          className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 ${isMenuOpen ? "block" : "hidden"}`}
          onClick={() => setIsMenuOpen(false)}
          style={{ touchAction: "manipulation" }}
          aria-hidden="true"
        ></div>
        
        {/* Mobile Navigation Menu */}
        <div
          className={`md:hidden fixed left-0 top-0 w-full bg-white shadow-lg pt-20 pb-6 border-t z-50 transition-transform duration-200 ${
            isMenuOpen ? "translate-y-0" : "-translate-y-full"
          }`}
          style={{ minHeight: "100vh" }}
        >
          {/* Search Bar for Mobile */}
          <div className="px-6 mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Search for Babalawos..."
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            </div>
          </div>
          
          <nav className="flex flex-col space-y-4 px-6">
            {navItems.map((item, index) => (
              <button
                key={index}
                onClick={() => handleNavigation(item)}
                className="text-gray-700 hover:text-primary transition-colors text-left py-2 focus:outline-none"
              >
                {item.label}
              </button>
            ))}
            
            <div className="flex flex-col space-y-3 pt-4 border-t border-gray-100 mt-4">
              <Button
                variant="outline"
                className="border-primary text-primary hover:bg-primary hover:text-white w-full justify-center"
                onClick={() => handleAuthNavigate("signin")}
              >
                <User className="w-4 h-4 mr-2" />
                Login
              </Button>
              <Button
                className="bg-primary text-white hover:bg-primary/90 w-full justify-center"
                onClick={() => handleAuthNavigate("signup")}
              >
                Sign Up
              </Button>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;