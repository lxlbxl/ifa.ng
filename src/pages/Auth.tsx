// Refs: src/pages/auth/SignInForm.tsx, src/pages/auth/SignUpForm.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SignInForm from './auth/SignInForm';
import SignUpForm from './auth/SignUpForm';
import { Loader2, Sparkles, Shield, Star, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TiltCard from '@/components/animations/TiltCard';
import ScrollReveal from '@/components/animations/ScrollReveal';
import CounterAnimation from '@/components/animations/CounterAnimation';

const Auth = () => {
  const { user, loading } = useAuth();

  // Redirect if already authenticated (now to /dashboard)
  if (user && !loading) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-20 left-10 w-64 h-64 rounded-full bg-gradient-to-br from-orange-200/30 to-pink-200/30 blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 30, 0],
            y: [0, 20, 0],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-gradient-to-br from-purple-200/30 to-blue-200/30 blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            x: [0, -30, 0],
            y: [0, -20, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
      </div>

      <div className="w-full max-w-6xl mx-auto grid lg:grid-cols-2 gap-8 items-center relative z-10">
        {/* Left side - Value proposition */}
        <ScrollReveal direction="left" className="hidden lg:block">
          <motion.div
            className="space-y-8"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div>
              <motion.div
                className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 mb-4 shadow-lg border border-orange-200"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
              >
                <Sparkles className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-semibold text-gray-900">
                  Join Our Growing Community
                </span>
              </motion.div>

              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
                Your Journey to{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-pink-600">
                  Spiritual Clarity
                </span>{" "}
                Starts Here
              </h1>

              <p className="text-lg text-gray-700 mb-6">
                Connect with authentic, verified Babalawos for personalized guidance through secure HD video sessions.
              </p>
            </div>

            {/* Trust indicators */}
            <div className="grid grid-cols-2 gap-4">
              <motion.div
                className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 shadow-lg"
                whileHover={{ y: -5, scale: 1.02 }}
                transition={{ type: "spring" }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 p-2">
                    <Users className="w-full h-full text-white" />
                  </div>
                  <div>
                    <CounterAnimation
                      end={10000}
                      suffix="+"
                      className="text-2xl font-bold text-gray-900"
                    />
                    <div className="text-xs text-gray-600 font-medium">Active Users</div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 shadow-lg"
                whileHover={{ y: -5, scale: 1.02 }}
                transition={{ type: "spring" }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 p-2">
                    <Star className="w-full h-full text-white fill-current" />
                  </div>
                  <div>
                    <CounterAnimation
                      end={4.9}
                      decimals={1}
                      suffix="/5.0"
                      className="text-2xl font-bold text-gray-900"
                    />
                    <div className="text-xs text-gray-600 font-medium">Avg Rating</div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="col-span-2 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200 shadow-lg"
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-center gap-3">
                  <Shield className="w-8 h-8 text-green-600" />
                  <div className="flex-1">
                    <div className="text-sm font-bold text-green-900">100% Verified Babalawos</div>
                    <div className="text-xs text-green-700">Secure & Confidential Sessions</div>
                  </div>
                  <div className="text-2xl">🔒</div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </ScrollReveal>

        {/* Right side - Auth form */}
        <ScrollReveal direction="right">
          <TiltCard tiltMaxAngleX={5} tiltMaxAngleY={5}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card className="w-full shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
                <CardHeader className="text-center space-y-2 pb-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                    className="w-16 h-16 mx-auto mb-2 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center shadow-lg"
                  >
                    <Sparkles className="w-8 h-8 text-white" />
                  </motion.div>
                  <CardTitle className="text-3xl font-bold text-gray-900">
                    Welcome to IFA.ng
                  </CardTitle>
                  <CardDescription className="text-base">
                    Connect with verified spiritual guides for authentic guidance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="signin" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6 bg-gray-100 p-1 rounded-xl">
                      <TabsTrigger
                        value="signin"
                        className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md transition-all"
                      >
                        Sign In
                      </TabsTrigger>
                      <TabsTrigger
                        value="signup"
                        className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md transition-all"
                      >
                        Sign Up
                      </TabsTrigger>
                    </TabsList>
                    <AnimatePresence mode="wait">
                      <TabsContent value="signin">
                        <motion.div
                          key="signin"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.3 }}
                        >
                          <SignInForm />
                        </motion.div>
                      </TabsContent>
                      <TabsContent value="signup">
                        <motion.div
                          key="signup"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.3 }}
                        >
                          <SignUpForm />
                        </motion.div>
                      </TabsContent>
                    </AnimatePresence>
                  </Tabs>
                </CardContent>
              </Card>
            </motion.div>
          </TiltCard>
        </ScrollReveal>
      </div>
    </div>
  );
};

export default Auth;
