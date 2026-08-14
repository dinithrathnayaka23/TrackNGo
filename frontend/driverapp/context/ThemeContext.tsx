import React, { createContext, useContext, useState } from 'react'; //createContext for creating a new context, useContext for consuming the context in components, and useState for managing the dark mode state

type ThemeContextType = {
  darkMode: boolean;
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>; //means this function will be used to update the darkMode state, and it takes a boolean value as an argument
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined); //undefined means that the context is not yet initialized
export function ThemeProvider({ children }: { children: React.ReactNode }) { // This component will wrap the entire app and provide the theme context to all child components. It takes a single prop, children, which represents the components that will be wrapped by this provider.
  const [darkMode, setDarkMode] = useState(false);

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode }}>
      {children} 
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext); // This hook returns the current value of the theme context

  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider'); // If the context is not available, throw an error
  }

  return context;
}