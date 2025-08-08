import { SignIn } from "@clerk/nextjs";

export default function App() {
  return (
    <div className="w-full h-[80vh] flex items-center justify-center bg-gray-100">
      <h1>Sign In Page</h1>
      {/* Render the SignIn component from Clerk */}
      <SignIn />
      
    </div>
  );
}
