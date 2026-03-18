export default function BlogLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="mx-auto flex flex-col gap-6 py-4 sm:gap-8 sm:py-6 lg:py-8">
      {children}
    </div>
  );
}
