import React, { Fragment, useState } from "react";
import { motion } from "framer-motion";
import Suggestion from "../component/suggestion";
import SearchParams from "../layout/explore/search-params";
import { Helmet } from "react-helmet-async";

export default function Search() {
  const [filters, setFilters] = useState({
    keyword: "",
    classificationTagId: "",
    directoryScope: "",
    sourceMemberId: "",
  });

  return (
    <Fragment>
      <Helmet>
        <title>Explore | NetMap</title>
        <meta name="description" content="Explore" />
        <link rel="canonical" href="/Explore" />
        <meta name="robots" content="index, follow" />
        <meta name="keywords" content="Explore" />
        <meta name="author" content="Explore" />
        <meta name="language" content="EN" />
      </Helmet>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex gap-6 w-full pb-20 flex-col lg:flex-row flex-1 min-h-0"
      >
        <div className="flex-[7] min-w-0 flex flex-col min-h-0">
          <Suggestion bio={true} filters={filters} onFiltersChange={setFilters} />
        </div>
        <div className="flex-[3] min-w-0 shrink-0">
          <SearchParams filters={filters} onFiltersChange={setFilters} />
        </div>
      </motion.div>
    </Fragment>
  );
}
