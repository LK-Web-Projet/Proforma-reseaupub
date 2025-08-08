import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function MainApp() {
  const { userId } = await auth();
  if (userId) {
    redirect("/facture");
  }
  return (
    <div className="flex items-center justify-center h-screen">
      <h1 className="text-2xl font-bold">Welcome to Proforma</h1>
      <p className="mt-2 text-gray-600">Explore the features and functionalities of Proforma.</p>
    </div>
  )
}