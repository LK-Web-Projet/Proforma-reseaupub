
export default function MainApp(){
  return (
    <div className="div">
      <h1 className="text-2xl font-bold">Welcome to Proforma</h1>
      <p className="mt-4">This is the main application page.</p>
      {/* Include other components or content here */}
      <p className="mt-2 text-gray-600">Explore the features and functionalities of Proforma.</p>
      {/* You can add more content or components as needed */}
      Signed in as: <span className="font-semibold">User</span>
      <div className="mt-4">

        <p className="mt-2 text-sm text-gray-500">Please sign in to continue.</p>
      </div>
    </div>
  )
}