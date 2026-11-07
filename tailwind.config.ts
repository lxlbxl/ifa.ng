
import type { Config } from "tailwindcss";
import { brand, scales, fonts, radii, shadows } from "./src/design/tokens";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '1.25rem',
			screens: {
				'2xl': '1320px'
			}
		},
		extend: {
			colors: {
				/* IFA.ng brand — see src/design/tokens.ts and DESIGN_SYSTEM.md */
				ink: brand.ink,
				cloth: brand.cloth,
				paper: brand.paper,
				line: brand.line,
				meet: brand.meet,
				green: scales.green,
				leaf: scales.leaf,
				sun: scales.sun,
				yellow: scales.sun,
				coral: scales.coral,
				red: scales.coral,
				indigo: scales.indigo,
				blue: scales.indigo,
				camwood: scales.camwood,
				orange: scales.camwood,
				amber: scales.sun,
				teal: scales.teal,
				emerald: scales.green,
				/* Legacy Lovable palettes folded into the brand so older screens match */
				purple: scales.green,
				violet: scales.green,
				pink: scales.coral,
				rose: scales.coral,
				gray: scales.neutral,
				slate: scales.neutral,
				zinc: scales.neutral,
				neutral: scales.neutral,
				stone: scales.neutral,
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					light: scales.green[500],
					dark: scales.green[800]
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))',
					light: scales.teal[400],
					dark: scales.teal[700]
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))',
					light: scales.sun[300],
					dark: scales.sun[600]
				},
				warm: {
					light: scales.neutral[50],
					DEFAULT: scales.neutral[100],
					dark: scales.neutral[200]
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			fontFamily: {
				display: [...fonts.display],
				sans: [...fonts.body],
				body: [...fonts.body],
				/* legacy alias: old screens use font-poppins */
				poppins: [...fonts.body],
			},
			fontSize: {
				'display-xl': ['clamp(56px, 11.5vw, 184px)', { lineHeight: '0.84', letterSpacing: '-0.045em', fontWeight: '800' }],
				'display-lg': ['clamp(40px, 6vw, 84px)', { lineHeight: '0.92', letterSpacing: '-0.04em', fontWeight: '800' }],
				'display-md': ['clamp(34px, 4.6vw, 64px)', { lineHeight: '0.95', letterSpacing: '-0.04em', fontWeight: '800' }],
				'display-sm': ['clamp(28px, 3.2vw, 40px)', { lineHeight: '1', letterSpacing: '-0.03em', fontWeight: '800' }],
				'eyebrow': ['12px', { lineHeight: '1', letterSpacing: '0.16em', fontWeight: '700' }],
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 4px)',
				sm: 'calc(var(--radius) - 8px)',
				pill: radii.pill,
				card: radii.card,
				panel: radii.panel,
				field: radii.field,
			},
			boxShadow: {
				sticker: shadows.sticker,
				'sticker-lg': shadows.stickerLg,
				lift: shadows.lift,
				float: shadows.float,
			},
			keyframes: {
				'fade-in': {
					'0%': {
						opacity: '0',
						transform: 'translateY(20px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'fade-in-up': {
					'0%': {
						opacity: '0',
						transform: 'translateY(30px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'fade-in-down': {
					'0%': {
						opacity: '0',
						transform: 'translateY(-30px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'slide-in-left': {
					'0%': {
						opacity: '0',
						transform: 'translateX(-100%)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateX(0)'
					}
				},
				'slide-in-right': {
					'0%': { transform: 'translateX(100%)' },
					'100%': { transform: 'translateX(0)' }
				},
				'scale-in': {
					'0%': {
						opacity: '0',
						transform: 'scale(0.9)'
					},
					'100%': {
						opacity: '1',
						transform: 'scale(1)'
					}
				},
				'float': {
					'0%, 100%': { transform: 'translateY(0px)' },
					'50%': { transform: 'translateY(-10px)' }
				},
				'bounce-subtle': {
					'0%, 100%': { transform: 'translateY(0)' },
					'50%': { transform: 'translateY(-5px)' }
				},
				'shimmer': {
					'0%': { transform: 'translateX(-100%)' },
					'100%': { transform: 'translateX(100%)' }
				},
				'glow': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.5' }
				},
				'marquee-rtl': {
					to: { transform: 'translateX(calc(-50% - var(--marquee-gap, 11px)))' }
				},
				'marquee-ltr': {
					from: { transform: 'translateX(-50%)' },
					to: { transform: 'translateX(0)' }
				},
				'drift': {
					from: { transform: 'scale(1.04) translate(0,0)' },
					to: { transform: 'scale(1.14) translate(-1.5%,1%)' }
				},
				'wave-bar': {
					'0%, 100%': { height: '5px' },
					'50%': { height: '20px' }
				},
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'fade-in': 'fade-in 0.6s ease-out',
				'fade-in-up': 'fade-in-up 0.7s ease-out',
				'fade-in-down': 'fade-in-down 0.6s ease-out',
				'slide-in-left': 'slide-in-left 0.5s ease-out',
				'slide-in-right': 'slide-in-right 0.3s ease-out',
				'scale-in': 'scale-in 0.4s ease-out',
				'float': 'float 3s ease-in-out infinite',
				'bounce-subtle': 'bounce-subtle 2s ease-in-out infinite',
				'shimmer': 'shimmer 2s ease-in-out infinite',
				'glow': 'glow 2s ease-in-out infinite',
				'marquee-rtl': 'marquee-rtl 46s linear infinite',
				'marquee-ltr': 'marquee-ltr 60s linear infinite',
				'drift': 'drift 26s ease-in-out infinite alternate',
				'wave-bar': 'wave-bar 1.1s ease-in-out infinite',
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
