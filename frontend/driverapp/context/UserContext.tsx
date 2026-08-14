import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  token: string;
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void; //void means it doesn't return anything
  error: string | null;
  setError: (error: string | null) => void;
  logout: () => void;
  isInitialized: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined); //undefined means that the context is not yet initialized

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => { // This component will wrap the entire app and provide the user context to all child components.
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false); // To track if the user data has been initialized

  // Initialize user from AsyncStorage on app start
  useEffect(() => {
    initializeUser();
  }, []); // Empty dependency array means this effect runs once when the component mounts

  const initializeUser = async () => {
    try {
      const savedUser = await AsyncStorage.getItem('user');
      if (savedUser) {
        setUserState(JSON.parse(savedUser)); // Parse the JSON string into a JavaScript object
      }
    } catch (err) {
      console.error('Error initializing user from storage:', err);
    } finally {
      setIsInitialized(true);
    }
  };

  const setUser = (newUser: User | null) => { // Update the user state
    setUserState(newUser);
  };

  const logout = async () => {
    setUserState(null);
    setError(null);
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('token');
  };

  const value: UserContextType = {
    user,
    setUser,
    isLoading, // Get the loading state
    setIsLoading, // Set the loading state
    error,
    setError, // Set the error state
    logout,
    isInitialized, // Get the initialized state
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>; // Pass the value to the provider
};

export const useUser = () => { // This hook returns the current value of the user context
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
