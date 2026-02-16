// Global state bridge between DashboardLayout and Navbar.
// Next.js app router layouts should not export custom functions, so we keep it here.

type MobileMenuState = {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

let state: MobileMenuState = { isOpen: false, setIsOpen: () => {} }

export function registerMobileMenuState(isOpen: boolean, setIsOpen: (open: boolean) => void) {
  state = { isOpen, setIsOpen }
}

export function setMobileMenuState(isOpen: boolean) {
  state.setIsOpen(isOpen)
}

export function getMobileMenuState(): boolean {
  return state.isOpen
}

