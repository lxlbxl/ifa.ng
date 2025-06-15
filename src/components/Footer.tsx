
import { Mail, Video, Shield } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xl">I</span>
              </div>
              <span className="text-2xl font-bold text-white">IFA Connect</span>
            </div>
            <p className="text-gray-200 mb-6 max-w-md leading-relaxed">
              Connecting souls with authentic spiritual guidance through verified Babalawos. 
              Your trusted platform for traditional wisdom in the modern world.
            </p>
            <div className="flex space-x-4">
              <div className="flex items-center text-sm text-gray-100">
                <Shield className="w-4 h-4 mr-2 text-green-400" />
                SSL Secured
              </div>
              <div className="flex items-center text-sm text-gray-100">
                <Video className="w-4 h-4 mr-2 text-blue-400" />
                HD Video Calls
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-lg mb-6 text-white">Quick Links</h3>
            <ul className="space-y-3">
              <li><a href="#home" className="text-gray-200 hover:text-white transition-colors">Home</a></li>
              <li><a href="#how-it-works" className="text-gray-200 hover:text-white transition-colors">How It Works</a></li>
              <li><a href="#babalawos" className="text-gray-200 hover:text-white transition-colors">Find Babalawos</a></li>
              <li><a href="#about" className="text-gray-200 hover:text-white transition-colors">About Us</a></li>
              <li><a href="#contact" className="text-gray-200 hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold text-lg mb-6 text-white">Support</h3>
            <ul className="space-y-3">
              <li><a href="#" className="text-gray-200 hover:text-white transition-colors">Help Center</a></li>
              <li><a href="#" className="text-gray-200 hover:text-white transition-colors">Safety Guidelines</a></li>
              <li><a href="#" className="text-gray-200 hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="text-gray-200 hover:text-white transition-colors">Terms of Service</a></li>
              <li><a href="#" className="text-gray-200 hover:text-white transition-colors">Refund Policy</a></li>
            </ul>
          </div>
        </div>

        {/* Contact Info */}
        <div className="border-t border-gray-700 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-6 mb-4 md:mb-0">
              <div className="flex items-center text-gray-300">
                <Mail className="w-4 h-4 mr-2" />
                support@ifaconnect.com
              </div>
              <div className="text-gray-300">
                Available 24/7 for support
              </div>
            </div>
            <div className="text-gray-400 text-sm">
              © 2024 IFA Connect. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
