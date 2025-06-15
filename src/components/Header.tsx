
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
              IFA Connect
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
            <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white">
              Login
            </Button>
            <Button className="bg-gradient-primary hover:opacity-90 text-white">
              Sign Up
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t pt-4">
            <nav className="flex flex-col space-y-4">
              <a href="#home" className="text-gray-700 hover:text-primary transition-colors">Home</a>
              <a href="#how-it-works" className="text-gray-700 hover:text-primary transition-colors">How It Works</a>
              <a href="#babalawos" className="text-gray-700 hover:text-primary transition-colors">Babalawos</a>
              <a href="#about" className="text-gray-700 hover:text-primary transition-colors">About</a>
              <div className="flex flex-col space-y-2 pt-2">
                <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white">
                  Login
                </Button>
                <Button className="bg-gradient-primary hover:opacity-90 text-white">
                  Sign Up
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
