import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50">
      <SignUp 
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-2xl rounded-2xl border border-indigo-100",
            headerTitle: "text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent",
            headerSubtitle: "text-gray-600",
            socialButtonsBlockButton: "border-indigo-200 hover:bg-indigo-50 transition-colors",
            formButtonPrimary: "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all duration-200",
            footerActionLink: "text-indigo-600 hover:text-purple-600"
          }
        }}
      />
    </div>
  );
}
