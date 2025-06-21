
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  };

  return (
    <header className="bg-white/95 backdrop-blur-sm shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">I</span>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              IFA.ng
            </span>
          </div>
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#home" className="text-gray-700 hover:text-primary transition-colors">Home</a>
            <a href="#how-it-works" className="text-gray-700 hover:text-primary transition-colors">How It Works</a>
            <a href="#babalawos" className="text-gray-700 hover:text-primary transition-colors">Babalawos</a>
            <a href="#about" className="text-gray-700 hover:text-primary transition-colors">About</a>
          </nav>
          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-4">
            <Button
              variant="outline"
              className="border-primary text-primary hover:bg-primary hover:text-white"
              onClick={() => handleAuthNavigate("signin")}
            >
              Login
            </Button>
            <Button
              className="border-primary text-primary hover:bg-primary hover:text-white"
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
        ></div>
        {/* Mobile Navigation Menu */}
        <div
          className={`md:hidden fixed left-0 top-0 w-full bg-white shadow-lg pt-20 pb-6 border-t z-50 transition-transform duration-200 ${
            isMenuOpen ? "translate-y-0" : "-translate-y-full"
          }`}
          style={{ minHeight: "100vh" }}
        >
          <nav className="flex flex-col space-y-4 px-6">
            <a href="#home" className="text-gray-700 hover:text-primary transition-colors" onClick={() => setIsMenuOpen(false)}>Home</a>
            <a href="#how-it-works" className="text-gray-700 hover:text-primary transition-colors" onClick={() => setIsMenuOpen(false)}>How It Works</a>
            <a href="#babalawos" className="text-gray-700 hover:text-primary transition-colors" onClick={() => setIsMenuOpen(false)}>Babalawos</a>
            <a href="#about" className="text-gray-700 hover:text-primary transition-colors" onClick={() => setIsMenuOpen(false)}>About</a>
            <div className="flex flex-col space-y-2 pt-2">
              <Button
                variant="outline"
                className="border-primary text-primary hover:bg-primary hover:text-white"
                onClick={() => {
                  setIsMenuOpen(false);
                  handleAuthNavigate("signin");
                }}
              >
                Login
              </Button>
              <Button
                className="bg-gradient-primary hover:opacity-90 text-white"
                onClick={() => {
                  setIsMenuOpen(false);
                  handleAuthNavigate("signup");
                }}
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
