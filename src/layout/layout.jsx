import Navbar from "../layout/navbar/navbar";

export const Layout = ({ Component }) => {
  return (
    <div className="flex w-full min-h-screen bg-bg-default">
      {/* Left sidebar - 25% (0 width on mobile; mobile nav is fixed) */}
      <div className="w-0 md:w-1/5 flex-shrink-0 min-w-0 overflow-visible">
        <Navbar />
      </div>
      {/* Main content - 75% split 70/30, resizable */}
      <main className="flex-1 flex min-h-screen min-w-0">
        <div className="flex-[7] min-w-0 flex justify-center overflow-auto">
          <div className="w-full pt-8 md:pt-0 mt-10 px-4">
            <Component />
          </div>
        </div>
      </main>
    </div>
  );
};
